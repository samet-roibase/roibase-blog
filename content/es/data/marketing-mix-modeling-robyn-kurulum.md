---
title: "Marketing Mix Modeling: Configuración práctica con Robyn"
description: "Construir un modelo de atribución con curvas de saturación, adstock decay y validación holdout en Robyn de Meta. SQL, R y pipeline de producción."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, atribucion, mmm]
readingTime: 8
author: Roibase
---

La deprecación de cookies y las regulaciones de privacidad desplazan la atribución de métodos determinísticos hacia modelado probabilístico. Marketing Mix Modeling (MMM) —herramienta estadística de los años 60— vuelve al centro. El framework Robyn de código abierto de Meta proporciona el brazo práctico de esta transformación: con inferencia bayesiana, curvas de saturación y adstock decay, vinculas gasto de marketing semanal a ventas mediante regresión que llevas a producción. Este artículo te muestra cómo configurar Robyn con datos reales, ejecutar grid search de hiperparámetros y prevenir overfitting con validación holdout.

## Qué es Robyn y su diferencia con regresión clásica

Robyn es un framework MMM de código abierto escrito en R. Meta lo desarrolló para su equipo de marketing en 2020 y lo lanzó en 2021. Sus diferencias con regresión lineal clásica:

**Transformación de adstock**: El efecto del marketing no es instantáneo — un anuncio de TV persiste en la mente durante semanas. Adstock modela cómo el gasto pasado contribuye a las ventas presentes mediante decay exponencial. Robyn soporta funciones de adstock geométrico y Weibull. El geométrico es simple: `adstock_t = spend_t + θ × adstock_(t-1)`, donde θ es el parámetro de decay. Weibull es más flexible — puedes posicionar el efecto pico con retraso.

**Saturación (rendimientos decrecientes)**: La relación gasto-ventas no es lineal. Los primeros 100K TL pueden generar 80% ROI mientras que los siguientes 100K generan 40%. Robyn aplica funciones de saturación Hill y S-curve. La ecuación de Hill: `y = V_max × x^n / (K^n + x^n)`, donde K es el punto semi-máximo y n es la pendiente. Esta no-linealidad es crítica para optimización de presupuesto por canal.

**Tuning de hiperparámetros**: Los valores de decay de adstock, K de saturación y n son desconocidos — los encuentras mediante grid search. Robyn usa algoritmo genético (NSGAII) probando miles de combinaciones de modelos, seleccionando el mejor trade-off de la frontera de Pareto.

## Preparación de datos: de SQL a granularidad semanal

Robyn funciona con granularidad semanal. Agregas logs de transacciones diarias a spend e ingresos semanales. Consulta ejemplo en BigQuery:

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

Esta consulta produce una fila por semana con 1 ingresos y N columnas de spend por canal. Se puede pasar a Robyn como CSV, pero en producción es más limpio extrae directamente desde BigQuery hacia R. Con el paquete `bigrquery`:

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Requisito mínimo de datos: 104 semanas (2 años). Menos datos conlleva riesgo de overfitting. Los priors bayesianos de Robyn funcionan con 52 semanas pero 104+ capturan mejor la estacionalidad.

## Configuración del modelo: robyn_inputs e hiperparámetros

Robyn crea objeto config con la función `robyn_inputs()`:

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Explicación de hiperparámetros:**

- **alpha**: Parámetro de pendiente de la función de saturación Hill (n). Alpha alto = saturación tardía.
- **gamma**: Parámetro K de Hill — punto semi-máximo. Gamma bajo = saturación temprana.
- **theta**: Decay de adstock geométrico. 0 = efecto termina instantáneamente, 0.7 = 70% se traslada a la siguiente semana.

Defines rango min-max para cada canal. Robyn ejecuta grid search dentro de este rango. Para TV, el límite superior de theta es 0.7 — share of mind persiste semanas. Para paid search es 0.3 — conversion es corto plazo.

## Ejecución del modelo: robyn_run y optimización pareto

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()` ejecuta algoritmo genético durante 2000 iteraciones probando combinaciones de hiperparámetros. En cada iteración minimiza NRMSE (error cuadrático medio normalizado) y DECOMP.RSSD (suma residual de cuadrados de descomposición). Selecciona 5 modelos de la frontera de Pareto — trade-off entre calidad de ajuste y lógica empresarial (ej. ROI de TV no puede ser más alto que search).

En el objeto output existe tabla `df_allpareto` — ROI a nivel de canal, ROAS y CPA de cada modelo. El número de filas = iteraciones × trials. Contiene columnas:

| Columna | Descripción |
|---------|-------------|
| `solID` | ID del modelo |
| `nrmse` | NRMSE normalizado — bajo = buen ajuste |
| `decomp.rssd` | RSSD de descomposición — bajo = contribuciones estables |
| `mape` | Error porcentual absoluto medio |
| `rsq_train` | R² en training |
| `google_search_spend_roi` | ROI de Google Search (revenue/spend) |
| `meta_paid_social_spend_roi` | ROI de Meta |
| `tv_spend_roi` | ROI de TV |

Selecciona el mejor modelo combinando NRMSE + DECOMP.RSSD + lógica empresarial. Robyn ofrece dashboard Shiny pero en producción la selección programática es más controlada:

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Validación holdout: prevenir overfitting

Un modelo ajustado con datos de training puede no generalizar a datos nunca antes vistos. En Robyn, validación holdout: excluyes las últimas 8-12 semanas del training y las usas como set de prueba. El modelo se ajusta con training, hace predicciones en test set. Si MAPE (mean absolute percentage error) en test está bajo 15%, el modelo está listo para producción.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Últimas 10 semanas excluidas
  # ... otros parámetros igual
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Predicción en test set
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

Si MAPE > 20% el modelo sufre overfitting. Necesitas estrechar rangos de hiperparámetros o agregar variables de contexto (ej. índice económico, clima). La regularización bayesiana de Robyn (penalización ridge) reduce overfitting pero validación holdout es la garantía final.

## Visualizar curvas de adstock y saturación

Robyn exporta con `robyn_outputs()` gráficos de adstock y saturación. En producción puedes exportarlos como PNG e insertarlos en dashboard de BI:

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

Archivos exportados:

- `saturate_curves.png` — Curva spend vs. response por canal. Eje X: gasto, Y: ingresos predichos. La curva se aplana en el punto de saturación.
- `adstock_curves.png` — Perfil de decay. Eje X: semana, Y: multiplicador de adstock. Para TV visible decay de 6-8 semanas.
- `waterfall.png` — Descomposición de ingresos: base + estacionalidad + contribución de canal.

Con estos gráficos dices al CMO "aumentar TV 30%" es menos potente que "desplazar 20% a search — el ROI total sube 12%".

## Pipeline de producción: dbt + Robyn + Looker Studio

MMM no es análisis único — necesita refresh semanal. Con el enfoque de [Estrategia de Contenido & Primer Nivel](https://www.roibase.com.tr/es/firstparty) de Roibase, el pipeline es:

1. **dbt**: Crea tabla `mmm_input` en BigQuery desde eventos raw (SQL anterior). Scheduled run cada lunes 00:00.
2. **Script R de Robyn**: Corre en contenedor Cloud Run. Extrae `mmm_input` con `bigrquery`, ejecuta `robyn_run()`, escribe output a BigQuery (`mmm_output`: `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio**: Alimentado por tabla `mmm_output` — trend de ROI por canal, curvas de saturación, dashboard de recomendación de presupuesto.

Empaques container en Dockerfile:

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm.R
CMD ["Rscript", "/app/run_mmm.R"]
```

Trigger con Cloud Scheduler cada lunes 06:00. Robyn con 2000 iteraciones tarda ~20 minutos (máquina con 8 cores).

## Realocación de presupuesto: decisiones desde frontera pareto

El output más poderoso de Robyn es el optimizador de presupuesto. Función `robyn_allocator()` redistribuye presupuesto entre canales maximizando ingresos totales:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = best_model_id,
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.5),   # Google, Meta, TV mantienen mín 70%, 70%, 50%
  channel_constr_up = c(1.5, 1.5, 2),      # Máx 150%, 150%, 200%
  expected_spend = 500000,                 # Presupuesto total
  expected_spend_days = 90
)
```

Tabla de output:

| Canal | Gasto Actual | Gasto Optimizado | Delta | Lift Esperado de Ingresos |
|-------|--------------|------------------|-------|--------------------------|
| Google Search | 200,000 | 180,000 | -10% | -2% |
| Meta Paid Social | 200,000 | 220,000 | +10% | +8% |
| TV | 100,000 | 100,000 | 0% | 0% |

Comunicas "desplazar 10% a Meta sube ingresos totales 6%". Las restricciones (multiplicadores 0.7-1.5) reflejan límites empresariales — ej. contrato de TV es 3 meses fijo, solo digital es flexible.

## Limitaciones de Robyn y combinación con tests de incrementalidad

MMM se basa en correlación — no causación. Si gasto de TV y ventas