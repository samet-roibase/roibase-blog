---
title: "Marketing Mix Modeling: Configuración práctica con Robyn"
description: "Configura la librería MMM de código abierto de Meta, Robyn, sobre tu stack de datos BigQuery. Aprende curvas de saturación, decay de adstock y validación con holdout."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 8
author: Roibase
---

La ventana de atribución se redujo a 7 días, el rechazo de consentimiento de cookies superó el 40%, la contribución entre canales multi-touch se volvió inmedible. En 2026, la única herramienta confiable en manos de un performance marketer es el modelo econométrico agregado: Marketing Mix Modeling. La librería Robyn, que Meta abrió en 2021, llevó este proceso a producción por primera vez. Cómo interpretar la curva de saturación, qué significa el decay de adstock, en qué rango funciona la validación con holdout — en este artículo configuraremos Robyn sobre BigQuery y responderemos estas preguntas.

## Qué es Robyn, y qué no es

Robyn es una librería de R. Lanzada como código abierto por el equipo de Marketing Science de Facebook. Su propósito: tomar gasto semanal o diario por canal + variables macroeconómicas externas (vacaciones, estacionalidad, precio) y correlacionar con tu métrica de ventas mediante regresión. Su salida: ROAS de cada canal, nivel de saturación, efecto de lag (adstock), asignación óptima de presupuesto.

Qué no es: no es atribución de último clic, no rastrea conversión a nivel de usuario. No utiliza datos personales, no espera señales de cookies. Emplea modelos de regresión de series temporales agregadas — no Ridge ni Lasso, sino optimización de hiperparámetros con Nevergrad que explora transformaciones no-lineales complejas.

En procesos MMM típicos se modelan 36 puntos de datos mensuales. Robyn funciona incluso con granularidad diaria — se recomiendan mínimo 104 semanas (2 años). Con menos de 52 semanas, la varianza se eleva y los intervalos de confianza resultan poco confiables.

## Curva de saturación: S-Curve y Hill Function

En el núcleo de Robyn hay dos transformaciones de saturación: Adbudg (S-curve) e Hill. Ambas codifican el supuesto de retornos marginales decrecientes (diminishing returns). Es decir, cada 1.000 TL adicional que gastes en un canal no generará el mismo aumento de conversiones que los primeros 1.000 TL.

**Fórmula de transformación Hill:**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K: respuesta máxima (asíntota)
- S: punto de semi-saturación (cuando el gasto alcanza este nivel, la respuesta llega al 50% de K)
- alpha: inclinación de la curva (alpha > 1 genera S-curve, alpha < 1 es cóncava)

Robyn optimiza los parámetros alpha y S para cada canal con Nevergrad. Prueba 10.000+ combinaciones y selecciona el mejor ajuste según el NRMSE más bajo (normalized root mean squared error).

**Interpretación práctica:**
- Si para Google Ads S = 50.000 TL, significa que con un gasto semanal de 50.000 TL alcanzas el 50% de tu potencial de respuesta.
- Si alpha = 2.5, la curva tiene forma de S empinada — por debajo de 50.000 TL el rendimiento es muy bajo, por encima crece muy lentamente.
- El optimizador de presupuesto usa estas curvas para responder: "¿Es mejor subir Google Ads de 50.000 a 60.000 TL, o Facebook de 30.000 a 40.000 TL?"

En el mundo real: el presupuesto de búsqueda típicamente sale cóncavo (alpha < 1), display/video sale como S-curve (alpha > 1). La búsqueda tiene demanda limitada, display tiene pool ilimitado pero atención limitada.

## Adstock Decay: modelado de efectos retrasados

El gasto en marketing puede impactar las ventas el mismo día, pero el efecto puede persistir semanas. Un anuncio de TV genera brand recall incluso 3 semanas después, el impacto de paid social decae en 7 días. Adstock modela matemáticamente este desfase (carryover) y la disminución (decay).

Robyn ofrece dos transformaciones de adstock:
1. **Adstock geométrico:** Decay exponencial. Parámetro theta (0-1). Theta = 0.5 significa que el 50% del efecto de la semana anterior se traslada a esta semana.
2. **Adstock Weibull:** Más flexible — peak delay + cola larga. Parámetros: shape (k) y scale (lambda). Preferido para canales como TV con impacto de pico retrasado.

**Fórmula de adstock geométrico:**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn optimiza theta (o k, lambda) para cada canal mediante búsqueda en rejilla. El usuario especifica un rango en hyperparameters.json (ej. 0-0.7), y el modelo encuentra el mejor theta.

**Qué necesitas hacer en práctica:**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),    # rango de theta para adstock
  google_ads_alphas = c(0.5, 3), # rango de alpha de saturación
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Resultado: si Google Ads tiene theta = 0.4 y Facebook Ads 0.2, significa que el impacto de Google Ads dura más tiempo. El planificador de presupuesto lo toma en cuenta — una cuarta parte del gasto en Google Ads sigue funcionando 2 semanas después, el de Facebook se agota en 1 semana.

### Bloque de código: Transformación geométrica de adstock simple (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Ejemplo: gasto en Google Ads
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Este código se ejecuta de forma optimizada a nivel C++ dentro de Robyn, pero la lógica es idéntica.

## Validación con Holdout: prueba de confiabilidad del modelo

Robyn corre el riesgo de overfitting al mejorar el ajuste del modelo. 10 canales + 5 variables macroeconómicas + parámetros de saturación y adstock para cada uno → 30+ variables. Con 104 puntos de datos esto significa demasiados grados de libertad.

Robyn usa validación con holdout: retira las últimas N semanas de los datos de entrenamiento, el modelo aprende del histórico, hace predicciones en el período holdout y calcula MAPE (mean absolute percentage error) contra los valores reales.

**Definición de holdout en Robyn:**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "ES"
)

# Holdout: últimas 8 semanas
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # últimas 8 semanas como set de test
)
```

**Interpretación de resultados:**
- NRMSE train < 0.10, NRMSE holdout < 0.15 → modelo confiable.
- NRMSE train = 0.05, holdout = 0.30 → overfitting, hay que reducir el rango de hiperparámetros.
- Decomp.RSSD (response sum of squared differences): qué porcentaje del revenue predicho explica la contribución total de los canales. 0.6+ es bueno, 0.8+ es excelente.

Robyn ejecuta 5 trials simultáneamente (diferentes random seeds de Nevergrad), cada uno con 2000 iteraciones, mostrando los mejores 10 modelos en el frente de Pareto. El usuario elige un modelo según restricciones de negocio (ej. "Google Ads ROAS no puede bajar de 3").

## Robyn con BigQuery: arquitectura del pipeline

Robyn corre en R pero la fuente de datos puede ser BigQuery. Stack típico:

1. **Data warehouse BigQuery:** tabla de gasto diario (spend_daily), tabla de conversiones (conversions_daily), variables macroeconómicas (holidays, weather, competitor_price).
2. **Transformación con dbt:** join + aggregation. Agregar a nivel semanal, crear columnas de gasto por canal.
3. **Script R (Cloud Run o Vertex AI):** traer datos de BigQuery con el paquete bigrquery, alimentar a Robyn, escribir resultados del modelo de vuelta en BigQuery.
4. **Dashboard Looker Studio:** visualizar output del modelo — ROAS por canal, asignación óptima de presupuesto, gráfico de saturación.

**Ejemplo de modelo dbt (marketing_mix_weekly.sql):**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

Esta tabla se materializa en BigQuery, el script R de Robyn la descarga con `bigrquery::bq_table_download()`. El output del modelo (contribución de cada canal por semana) se escribe de nuevo en BigQuery — las herramientas BI lo leen desde ahí.

## Budget Optimizer: asignación Pareto-óptima

Después de ajustar el modelo, Robyn ejecuta un segundo módulo: el asignador de presupuesto. Entradas: presupuesto total (ej. 500.000 TL/semana), restricciones de gasto por canal (ej. Google Ads mínimo 50.000 TL). Salida: distribución óptima para maximizar ROAS.

El algoritmo toma la derivada de la curva de saturación de cada canal (ROAS marginal) y desplaza el gasto hasta que el ROAS marginal se equilibra. Es optimización con multiplicadores de Lagrange.

**Tabla de resultados ejemplo:**

| Canal | Gasto actual | Gasto óptimo | Delta | ROAS actual | ROAS óptimo |
|---|---|---|---|---|
| Google Ads | 200.000 TL | 180.000 TL | -20.000 | 4.2 | 4.5 |
| Facebook Ads | 150.000 TL | 200.000 TL | +50.000 | 3.8 | 4.1 |
| TikTok Ads | 100.000 TL | 120.000 TL | +20.000 | 3.5 | 3.9 |
| Display | 50.000 TL | 0 TL | -50.000 | 1.2 | — |

Interpretación: el canal Display genera ROAS 1.2 incluso muy por debajo de saturación — hay que eliminarlo. Google Ads está por encima del punto de saturación, reducir 20.000 TL aumenta ROAS. Facebook Ads está a mitad de la curva plana, aumentar presupuesto es eficiente.

Esta tabla se presenta al CFO, el output SQL de Robyn se visualiza en Looker. El mecanismo de decisión se vuelve data-driven — "Este mes demos 50.000 TL más a Facebook" deja de ser intuición para ser output del modelo.

---

Para configurar Robyn necesitas 2 años de datos granulares a nivel semanal, entorno R, conexión a BigQuery y 4-6 horas de ajuste de hiperparámetros. Una vez en producción, se recicla el modelo 1 vez al mes (se añaden 4 nuevas semanas de datos, la ventana de holdout se desplaza). Las curvas de saturación y parámetros de adstock cambian con el tiempo — en mes de vacaciones el theta de Facebook baja, en Black Friday sube el alpha de Google Ads. Robyn no captura esta dinámica automáticamente, pero aumentar la frecuencia de reentrenamiento lo acerca. Si tu arquitectura de datos [first-party está bien cimentada](https://www.roibase.com.tr/es/firstparty) en BigQuery, Robyn descansa sobre esa base sólida y hace que el MMM agregado sea operacional. En el mundo post-cookies, la atribución ha cedido paso al modelo econométrico — Robyn es la primera herramienta de código abierto que lo hace viable en producción.