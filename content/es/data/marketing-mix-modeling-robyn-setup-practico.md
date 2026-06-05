---
title: "Marketing Mix Modeling: Configuración Práctica con Robyn"
description: "El framework MMM de código abierto de Meta, Robyn, con saturación, adstock y validación holdout usando código R y estructura de datos correcta."
publishedAt: 2026-06-05
modifiedAt: 2026-06-05
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, incrementality]
readingTime: 8
author: Roibase
---

En el mundo de la medición post-cookie, la atribución pierde señal cada día. Con iOS 17.4 y SKAdNetwork teniendo dificultades para mostrar el verdadero ROAS, los dueños de presupuesto de marketing se giran hacia modelos econométricos para medir la verdadera contribución de cada canal. Marketing Mix Modeling (MMM), método estadístico desarrollado en los años 60 para publicidad televisiva, vuelve al centro del escenario en 2026 junto a server-side measurement y data lakes de first-party. **Robyn**, lanzado como código abierto por Meta en 2021, acelera esta metodología basada en regresión añadiendo aprendizaje automático moderno y optimización bayesiana.

## Por qué MMM es crítico ahora

El modelo de atribución last-click colapsa con la pérdida de cookies, mientras que la atribución multi-touch (MTA) se vuelve inutilizable post-GDPR y ATT por requerir datos a nivel de evento. La atribución data-driven de Google Analytics 4 se basa en aprendizaje automático pero solo funciona dentro del ecosistema de Google. Sin embargo, el 60% del presupuesto de marketing sigue siendo gastado fuera de Google: Meta, TikTok, display programático, TV offline, patrocinios.

MMM se basa en datos **agregados** a nivel semanal o diario, no en rastreo a nivel de usuario. El modelo de regresión extrae la relación entre el gasto de cada canal y las ventas (o conversiones). El modelo descansa en dos suposiciones fundamentales: **saturación** (el gasto creciente genera retornos marginales decrecientes) y **adstock** (el anuncio de hoy afecta a las semanas futuras). Estas suposiciones son estadísticas pero reflejan realidad comercial. Robyn busca encontrar automáticamente estos dos parámetros mediante optimización bayesiana de hiperparámetros. En versiones posteriores a 2024 (v3.11+), se añadió **ridge regression** y **descomposición de series temporales Prophet**, aumentando la precisión estacional del modelo.

Otra característica crítica de Robyn es la **validación holdout**: entrena el modelo con datos de 12 semanas anteriores y predice las siguientes 4 semanas para medir el error out-of-sample. Este elemento previene overfitting y demuestra que el modelo realmente está aprendiendo los canales. Las soluciones MMM de Meridian de Google y las antiguas de Facebook usan enfoques similares pero son closed-source y costosas. Robyn proporciona acceso gratuito a la misma metodología.

## Estructura de datos y preparación

El formato de datos que necesita Robyn es el siguiente: cada fila es una unidad de tiempo (día o semana), cada columna es un gasto de canal o métrica de conversión. Se recomiendan mínimo 104 semanas (2 años) porque la significación estadística de los coeficientes de regresión depende del tamaño de la muestra. Con menos de 52 semanas experimentarás problemas de convergencia del modelo.

```r
# Estructura de datos de ejemplo — agrega semanal extraída de BigQuery
df <- data.frame(
  DATE = seq.Date(from = as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = runif(104, 80000, 150000),
  google_search_spend = runif(104, 5000, 15000),
  meta_spend = runif(104, 8000, 20000),
  tiktok_spend = runif(104, 2000, 8000),
  tv_grp = runif(104, 50, 200),
  organic_sessions = runif(104, 10000, 30000),
  competitor_index = runif(104, 0.8, 1.2)
)
```

**Detalles importantes:**
- La columna `DATE` debe estar en clase Date, no string
- Revenue o conversion entra en el modelo como variable objetivo (variable dependiente)
- Los canales (google_search_spend, meta_spend) son columnas de medios **pagados** — se les aplica adstock y saturación
- Variables como `organic_sessions` y `competitor_index` son variables **orgánicas / de control** — no se les aplica transformación de saturación, se usan para extracción de baseline
- Si tienes datos de canal offline como TV, normaliza como GRP, reach o minutos visualizados

Robyn no trabaja con etiquetas manuales como `facebook_spend`; definen los nombres de columna tú mismo pero debes especificar explícitamente en la función `InputCollect()` qué columnas son paid y cuáles son organic.

[La arquitectura de datos first-party](https://www.roibase.com.tr/es/firstparty) es difícil de implementar si no la has construido. Server-side GTM, exportación raw de GA4, APIs de Meta/Google Ads, datos de ventas del sistema CRM — necesitas combinarlos en BigQuery y hacer rollup semanal. Cuando configuramos este pipeline ETL con dbt, generamos la tabla `fact_marketing_weekly` lista para MMM.

## Configuración de saturación y adstock

La fortaleza de Robyn es que puede optimizar **por separado** la curva de saturación y los parámetros de decay de adstock para cada canal. La saturación se modela con la función de Hill:

```
effect = spend^alpha / (spend^alpha + half_saturation^alpha)
```

El parámetro `alpha` determina la concavidad de la curva, `half_saturation` determina el nivel de gasto donde el efecto alcanza su punto medio. Los canales basados en intención como Google Search saturan temprano (alpha bajo, half_saturation bajo). Los canales de conciencia de marca (TV, YouTube) saturan tarde.

Adstock modela el efecto del gasto pasado en el presente. El adstock geométrico es la forma más común:

```
adstocked_spend[t] = spend[t] + theta * adstocked_spend[t-1]
```

`theta` (entre 0 y 1) es la velocidad de decay. Para TV el theta es alto (0.7-0.9 — el efecto dura semanas), para search es bajo (0.1-0.3 — el efecto termina rápido). Robyn encuentra estos parámetros mediante optimización Nevergrad, pero tú debes proporcionar el **rango anterior**:

```r
hyperparameters <- list(
  google_search_spend_alphas = c(0.5, 1.5),
  google_search_spend_gammas = c(0.1, 0.4), # adstock decay
  google_search_spend_thetas = c(0, 0.3),   # adstock theta
  meta_spend_alphas = c(0.5, 2.0),
  meta_spend_gammas = c(0.3, 0.8),
  meta_spend_thetas = c(0.2, 0.6),
  tv_grp_alphas = c(1.0, 3.0),
  tv_grp_gammas = c(0.5, 0.9),
  tv_grp_thetas = c(0.6, 0.9)
)
```

Debes determinar estos rangos con conocimiento del dominio. Si los das completamente al azar, el modelo diverge o encuentra coeficientes sin sentido (como un efecto negativo de TV). La documentación de Robyn ofrece recomendaciones de rangos por defecto pero no los uses sin probar en tus datos primero.

## Entrenamiento del modelo y validación holdout

Para ejecutar Robyn usas la función `robyn_run()`. Internamente, la librería **Nevergrad** busca la mejor combinación de hiperparámetros mediante optimización bayesiana. Una ejecución típica significa 2000 iteraciones x 10 trials = 20,000 entrenamientos de modelo. En MacBook M1 con 8 cores toma ~15 minutos.

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "DATE",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_vars = c("google_search_spend", "meta_spend", "tiktok_spend"),
  paid_media_spends = c("google_search_spend", "meta_spend", "tiktok_spend"),
  organic_vars = c("organic_sessions"),
  prophet_vars = c("trend", "season", "holiday"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric",
  hyperparameters = hyperparameters
)

OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 10,
  outputs = FALSE
)
```

Después del entrenamiento del modelo, muestra las soluciones **Pareto-óptimas**. Robyn optimiza dos métricas: NRMSE (error cuadrático medio normalizado) y RSSD de descomposición (diferencia de suma de residuos al cuadrado). Cada modelo en la frontera de Pareto es un trade-off: uno tiene buen fit pero mala descomposición, otro lo opuesto. Debes seleccionar manualmente el modelo más razonable.

Para validación holdout, reservas las últimas 4-8 semanas. Robyn lo hace automáticamente:

```r
robyn_refresh(
  robyn_object = OutputModels,
  dt_input = df_new, # Refresh con datos nuevos
  refresh_steps = 4,
  refresh_mode = "manual"
)
```

Si el MAPE holdout (error porcentual absoluto medio) está por debajo del 10%, el modelo se considera confiable. Por encima del 20% es peligroso — señal de overfitting o variable faltante.

## Interpretar salidas y optimización de presupuesto

La salida más crítica de Robyn es la tabla de **channel contribution**. Muestra la contribución al revenue de cada canal en porcentaje y su **ROAS** (retorno sobre gasto en anuncios). Pero atención: estos valores son ROAS histórico, no **ROAS marginal**. El ROAS marginal muestra cuánto revenue adicional generará el siguiente gasto de 1000 TL y se calcula como la derivada de la curva de saturación.

La función `budget_allocator()` de Robyn redistribuye el presupuesto existente según las curvas de saturación. Si Google Search está saturado, traslada el presupuesto excedente a Meta o TikTok. Esta optimización encuentra el punto donde el retorno marginal se iguala entre canales (economía 101: MR₁ = MR₂).

```r
AllocatorCollect <- robyn_allocator(
  robyn_object = OutputModels,
  select_model = "1_100_2", # ID del modelo que seleccionaste de Pareto
  scenario = "max_response_expected_spend",
  channel_constr_low = c(0.7, 0.7, 0.5), # Mínimo 70% Google, 70% Meta, 50% TikTok
  channel_constr_up = c(1.5, 2.0, 3.0),  # Límites de aumento máximo
  expected_spend = 100000
)
```

La salida muestra cómo distribuir tu presupuesto de 100,000 TL para obtener revenue óptimo. Pero esta es una recomendación estática — en la realidad cambian creative refresh, actividad competitiva, seasonality. Por eso debes hacer refresh de MMM **mensualmente**.

## Trade-offs y limitaciones

A diferencia de attribution, MMM trabaja a **nivel agregado**. Esto significa que no puede usarse para personalización. En Google Search, MMM no puede mostrar qué keyword funcionó mejor — solo mide la contribución total de Search. Además, el modelo es vulnerable al problema **correlation ≠ causation**: si las ventas suben en verano y tú también aumentas gasto en TV en verano, el modelo podría dar demasiado crédito a TV.

Para resolver esto, debes validar MMM con **pruebas de incrementalidad**. Mide el efecto causal real con geo-lift o holdout test y compáralo con los resultados de MMM. Robyn puede incluir resultados de incrementalidad como parámetro `calibration` — esto actúa como prior bayesiano y acerca el modelo a la realidad.

Otra dificultad es **integrar canales nuevos**. Si abres un canal nuevo (por ejemplo Snapchat) y solo tienes 8 semanas de datos, Robyn no puede aprender su curva de saturación. En este caso, debes establecer el prior manualmente o excluir las primeras 12 semanas e integrarlo después.

Finalmente, MMM es **más fuerte cuando combina offline y online**. Si no incluyes el gasto en canales offline como TV, outdoor, patrocinios, el modelo da demasiado crédito a los canales online (sesgo de variable omitida). Robyn es flexible en esto: acepta variables proxy como GRP, reach, o incluso volumen de búsqueda de marca.

Un pipeline MMM correctamente configurado transforma la planificación presupuestaria del equipo de marketing de un juego de adivinanzas a ingeniería basada en evidencia. Robyn hace accesible esta transformación como código abierto — pero la estructura de datos, tuning de hiperparámetros y validación de incrementalidad requieren experiencia humana. Los equipos que invierten en regresión econométrica en lugar de atribución en 2026 estarán 12 meses adelante de sus competidores en 2027.