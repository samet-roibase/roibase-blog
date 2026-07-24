---
title: "Marketing Mix Modeling: Configuración práctica con Robyn"
description: "Configurar MMM con el framework Robyn de Meta: curvas de saturación, decay de adstock, validación holdout. Incluye código R e integración con BigQuery."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, data-science, bigquery]
readingTime: 8
author: Roibase
---

La atribución se ha roto en los últimos tres años. iOS 14.5, Consent Mode v2, la retirada de las cookies de terceros — todo deja al especialista en marketing digital frente a la misma pregunta: ¿qué canal funciona realmente? Marketing Mix Modeling (MMM) es la respuesta estadística que rompe la dependencia de cookies y píxeles, operando sobre datos agregados a nivel total. El framework Robyn de código abierto de Meta transforma MMM de un ejercicio académico a un pipeline productivo. Este artículo proporciona pasos concretos para configurar Robyn desde cero, interpretar curvas de saturación, ajustar parámetros de adstock decay y validar el modelo con técnicas holdout.

## Qué es MMM y por qué es crítico ahora

Marketing Mix Modeling explica la relación entre gasto en medios y ventas o conversiones mediante estadística basada en regresión. No requiere datos a nivel de usuario — trabaja con métricas agregadas semanales o diarias como gasto total, impresiones y ventas. El modelo calcula la contribución marginal (incrementality) de cada canal y muestra cuándo un canal entra en saturación.

La atribución last-click clásica es basada en píxeles — asigna crédito al último canal en el que el usuario hizo clic. MMM, en cambio, observa todos los canales en la misma ventana temporal para aislar correlaciones. Por ejemplo, si la publicidad televisiva tiene un retraso de 3 semanas con respecto a las ventas (efecto carry-over), el modelo captura este retraso con el parámetro "adstock". La curva de saturación muestra rendimientos decrecientes: los primeros 100.000 TL en gasto generan 50 conversiones, mientras que los siguientes 100.000 TL generan solo 20.

Robyn presenta este framework matemático como un paquete R que Meta ha entrenado con sus propios datos de campaña. Incluye regresión bayesiana, algoritmos evolutivos multiobjetivo (MOEA) para sintonización de hiperparámetros y optimización Nevergrad. La configuración no es manual — después de preparar los datos, 50 líneas de código R generan el modelo.

## Preparación de datos: de BigQuery a Robyn

Robyn espera un CSV/data.frame único como entrada. Cada fila es un período de tiempo (semana o día), cada columna es gasto de un canal, impresiones o métrica de ventas. No acepta datos faltantes — si hay celdas vacías, debes realizar imputación. A continuación, el esquema mínimo:

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

Para extraer estos datos de BigQuery con agregación semanal:

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

La variable de control (tendencia, estacionalidad, indicador macroeconómico) no es obligatoria pero aumenta el poder explicativo del modelo. Por ejemplo, en retail, si enero es un mes de descuentos, añade una variable ficticia. Robyn incorpora estas variables como baseline "orgánico" en la regresión.

Para transferir datos a R, usa el paquete `bigrquery`:

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

Para verificar la conformidad del formato de datos con Robyn, la función `robyn_inputs()` valida el esquema. La columna de fecha debe ser de clase Date, y las métricas deben ser numéricas.

## Configuración del modelo Robyn: adstock y saturación

El núcleo de Robyn son las funciones `robyn_inputs()` y `robyn_run()`. El primer paso es definir los inputs del modelo:

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "ES",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Selección del tipo de adstock:**
- `geometric`: El más común. La tasa de decay es constante (por ejemplo, cada semana se mantiene el 80%). Adecuada para TV y display.
- `weibull`: Decay asimétrica — caída rápida al principio, luego ralentización. Lógica para vídeo e influencer marketing.

Fórmula de adstock geométrico:

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` es la tasa de decay (entre 0-1). Robyn optimiza automáticamente este parámetro, pero puedes proporcionar un rango manual:

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # coeficiente de la curva de saturación
  tv_spend_gammas = c(0.3, 1),       # punto de inflexión de saturación
  tv_spend_thetas = c(0, 0.5),       # tasa de decay de adstock
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Parámetros de saturación:**
- `alpha`: La forma de la curva. Alpha alto → saturación tardía.
- `gamma`: Punto de inflexión — 0.5 significa inflexión en el punto medio.

Saturación con ecuación Hill:

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn optimiza estos parámetros mediante un algoritmo evolutivo. Genera 2000 modelos y selecciona los mejores trade-offs de la frontera de Pareto (balance entre R² y NRMSE).

## Ejecución del modelo e interpretación de resultados

Para ejecutar el modelo Robyn:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

La salida es una lista — cada iteración es un conjunto diferente de hiperparámetros. Robyn selecciona automáticamente los 3 mejores modelos (óptimos de Pareto). Los resultados incluyen:

```r
OutputModels$resultHypParam    # parámetros de todos los modelos
OutputModels$xDecompAgg        # descomposición de contribución por canal
OutputModels$resultCalibration # puntuación de validación holdout
```

**Tabla de descomposición de ejemplo:**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**Interpretación de ROI:** Facebook 1.20 — cada 1 TL de gasto genera 1.20 TL de retorno. TV 0.75 — no es ROI negativo, sino 0.75 TL de contribución incremental por encima del baseline. Robyn mide "incrementality", no crédito last-click.

**Detección de saturación:** Robyn grafica la curva de saturación:

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

En el gráfico, observa dónde la curva se aplana a medida que aumenta el gasto. Por ejemplo, si el gasto en TV supera 80.000 TL, la ganancia marginal cae un 50% — esta es una señal crítica para optimizar el presupuesto.

## Validación holdout y confiabilidad del modelo

Para que un modelo MMM sea utilizable en producción, divide los datos históricos en: conjunto de entrenamiento (por ejemplo, 2022-octubre 2024) + conjunto holdout (noviembre-diciembre 2024). El modelo se entrena con el conjunto de entrenamiento y se prueba con el holdout. Si el MAPE (error porcentual absoluto medio) está por debajo del 10%, el modelo es confiable.

Robyn realiza validación holdout automáticamente:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # últimas 52 semanas como holdout
  rollingWindowEndWhich = 4
)
```

El resultado aparece en la tabla `resultCalibration`:

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (error cuadrático medio normalizado):** Valores bajos = bueno. 0.12 es aceptable (por debajo de 0.15 es production-ready).
**decomp.rssd:** Consistencia de descomposición entre entrenamiento y validación. 0.05 → desviación del 5% → modelo estable.

Si la validación holdout falla, hay dos posibilidades: (1) Datos insuficientes — necesitas al menos 2 años de datos semanales. (2) Variables faltantes — añade estacionalidad, gasto de competencia, cambios de precio u otras variables confusoras.

## Vinculación de salida de Robyn con el mecanismo de decisión

Para cargar nuevamente los resultados de Robyn en BigQuery, exporta la tabla de descomposición como CSV:

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

Cárgalo en BigQuery:

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

Esta tabla se conecta a dashboards (Looker, Tableau) u optimizadores de presupuesto. Por ejemplo, usa un modelo dbt para calcular el umbral de saturación:

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

Esta consulta ordena los canales con ROI > 1.0 — tu lista de prioridades para aumentar presupuesto. Robyn también tiene una función de asignador de presupuesto:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

La salida sugiere un presupuesto nuevo para cada canal. Las restricciones mantienen los cambios entre el 70-150% del gasto actual (evitando riesgo operacional por cambios abruptos).

La configuración de [Medición e Infraestructura de Primera Parte](https://www.roibase.com.tr/es/firstparty) es crítica para MMM — la calidad de los datos que se alimentan en Robyn afecta directamente la confiabilidad del modelo. Sin rastreo de eventos server-side, resolución de identidad e integración de consent mode, el sesgo en el nivel de agregación es inevitable.

## Trampas comunes y mitigación

**Multicolinealidad:** Si dos canales siempre están activos simultáneamente (por ejemplo, TV y Facebook siempre se ejecutan juntos), el modelo no puede separar sus contribuciones. Se requiere verificación del Factor de Inflación de Varianza (VIF):

```r
library(car)
vif_model <- lm(revenue ~ tv_spend + fb_spend + google_spend, data = df)
vif(vif_model)
```

VIF > 5 → hay problema. Soluciones: (1) Pausar temporalmente un canal y ejecutar un test holdout. (2) Recopilar serie temporal más larga.

**Incertidumbre de período de retraso:** Si el parámetro de adstock está mal configurado (por ejemplo, 1 semana para TV en lugar de 4), el modelo producirá resultados engañosos. Valida el tiempo real de decay con A/B testing o experimentos geo. El paquete GeoLift de Meta lo hace.

**Falta de control de estacionalidad:** Si los componentes de Prophet (tendencia, estación, feriado) no se añaden al modelo, el aumento de ventas en enero puede atribuirse a medios (cuando realmente es efecto del descuento de Año Nuevo). Siempre activa Prophet:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "ES"
)
```

**Drift del modelo:** Cuando la dinámica del mercado cambia (competidor nuevo