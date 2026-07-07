---
title: "Marketing Mix Modeling: Configuración Práctica con Robyn"
description: "Demostramos la configuración de la librería MMM open-source de Meta, Robyn, incluyendo curvas de saturación, adstock decay y validación holdout sobre datos de producción."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, media-attribution]
readingTime: 8
author: Roibase
---

Los modelos de atribución multitouch pierden confiabilidad en la era post-cookie, mientras que el marketing mix modeling resurge como protagonista. Las herramientas MMM open-source de Google y Meta (LightweightMMM, Robyn) permiten al marketer medir la efectividad del canal a nivel agregado. En 2025, Robyn 3.11 de Meta alcanzó madurez productiva con optimización Bayesiana y búsqueda paralela de hiperparámetros. Este artículo presenta la configuración de Robyn en torno a tres conceptos fundamentales: curva de saturación (rendimientos decrecientes), adstock decay (efecto retrasado) y validación holdout (confiabilidad del modelo).

## Qué es Robyn y por qué importa ahora

Robyn es un paquete R lanzado por Meta en 2021 como software open-source. El modelo, construido sobre regresión ridge, ingiere datos de gasto por canal y conversiones en agregación semanal o diaria, y calcula la contribución de conversión incremental de cada canal. Con la gran actualización de 2024, el modelo integró componentes de series temporales de Prophet y ganó soporte de exportación basada en JSON — permitiendo conexión a flujos de trabajo Python.

Tres características diferencian a Robyn de otros enfoques MMM: primero, modela la relación gasto-conversión no linealmente mediante la transformación Hill-Adstock (saturación realista); segundo, resuelve la optimización de hiperparámetros con algoritmo genético y optimizador Nevergrad sin gradiente (sin necesidad de ajuste manual); tercero, reporta automáticamente métricas de calidad del modelo (NRMSE, DECOMP.RSSD, MAPE). Para confiabilidad en producción, la función integrada de validación holdout es crítica — la demostraremos más adelante.

La ventaja del marketing mix modeling sobre atribución es que trabaja con datos agregados, evitando limitaciones GDPR/CCPA y complejidad de journeys multi-dispositivo. La desventaja es la granularidad semanal — no sirve para optimización intraday, solo para asignación de presupuesto trimestral. En Roibase, dentro de la [arquitectura de datos first-party](https://www.roibase.com.tr/es/firstparty), posicionamos MMM junto con resultados de pruebas de incrementalidad: un canal con ROAS alto en MMM no es suficiente — requiere validación mediante test geo-split o control sintético.

## Preparación de datos: gasto por canal + variables macroeconómicas

Robyn requiere como entrada mínima estas columnas en una serie temporal semanal:

```r
# Estructura de datos de ejemplo (2 años de datos semanales)
data <- data.frame(
  date = seq(as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = rnorm(104, 50000, 8000),
  facebook_spend = rnorm(104, 5000, 1000),
  google_search_spend = rnorm(104, 7000, 1500),
  display_spend = rnorm(104, 3000, 800),
  competitor_index = rnorm(104, 100, 15),  # variable macroeconómica
  holiday_flag = sample(0:1, 104, replace = TRUE)
)
```

**Número de columnas de canal:** Mínimo 2, máximo 15 recomendado. Con 20+ canales, riesgo de overfitting aumenta y estabilidad de coeficientes cae. Si existen canales long-tail (affiliate, influencer, podcast), agruparlos en una sola columna `other_digital` es más saludable.

**Variables macroeconómicas:** Deben incluir seasonalidad, festivos, índice competidor, indicadores económicos — de lo contrario, el modelo puede atribuir todo crecimiento de conversiones a canales de medios. La integración de Prophet en Robyn captura automáticamente tendencia y festivos, pero shocks específicos del sector (Black Friday, Ramadán) requieren `holiday_flag` explícito.

**Controles de calidad de datos:**
- Ninguna columna debe tener varianza cero (gasto constante = inútil)
- Tolerancia de valores faltantes: máximo 5% — Robyn no imputa automáticamente
- Granularidad semanal es preferida — datos diarios aumentan ruido, datos mensuales resultan en observaciones insuficientes

Si datos de gasto provienen de múltiples fuentes (Google Ads API, Meta Marketing API, sistemas internos de finanzas), establece un pipeline ETL. En nuestro flujo de producción, tenemos tabla `marketing_spend_weekly` en BigQuery; cada lunes por la mañana, el modelo dbt actualiza esta tabla y el script R la consume, activando Robyn.

## Saturación y adstock: transformación Hill-Adstock

Robyn procesa cada gasto de canal a través de dos transformaciones: primero adstock (efecto retrasado), luego saturación (rendimientos decrecientes).

### Adstock decay (geométrico o Weibull)

El impacto de un anuncio de TV no termina instantáneamente — persiste semanas en la memoria del espectador. Adstock lo modela. Robyn soporta dos tipos: `geometric` (simple, decaimiento exponencial) y `weibull` (flexible, curva S).

**Adstock geométrico:**

```
adstocked_spend[t] = spend[t] + θ × adstocked_spend[t-1]
```

Aquí `θ` (theta) es la tasa de decay — 0.5 significa que la mitad del efecto de la semana anterior se transfiere a esta semana. Robyn busca automáticamente este parámetro entre 0–0.9.

**Adstock Weibull:** Más complejo — tiene parámetros shape y scale. Para canales "awareness" (TV, outdoor, influencer), Weibull ajusta mejor porque el efecto puede comenzar lentamente, alcanzar pico y luego caer rápido.

**Recomendación práctica:** En la primera iteración del modelo, usa geométrico — convergencia más rápida. Si performance es baja (NRMSE > 0.15) y el mix es heavy en awareness, prueba Weibull.

### Saturación: función Hill

Doblar gasto no dobla conversiones — existen rendimientos decrecientes. Robyn lo modela con ecuación Hill:

```
effect = spend^α / (K^α + spend^α)
```

- `α` (alpha): inclinación de la curva — pequeño = saturación lenta, grande = rápida
- `K`: punto de semi-saturación — cuando gasto alcanza este nivel, se logra la mitad del efecto máximo

Robyn encuentra estos dos parámetros para cada canal durante la búsqueda de hiperparámetros. El resultado: ves la "response curve" de cada canal — por ejemplo, Facebook Ads se aplana después de €10K, mientras Google Search sigue lineal hasta €20K.

**Utilidad de la curva de saturación:** Scenarios de reasignación de presupuesto. Si la pendiente de un canal ya es plana (flat), transferir presupuesto desde allí hacia un canal con pendiente más pronunciada aumenta ROAS total.

## Ejecución del modelo e ionización de hiperparámetros

Instalación de Robyn en dos líneas:

```r
install.packages("Robyn")
library(Robyn)
```

En `InputCollect` defines la estructura de datos:

```r
InputCollect <- robyn_inputs(
  dt_input = data,
  date_var = "date",
  dep_var = "revenue",
  paid_media_spends = c("facebook_spend", "google_search_spend", "display_spend"),
  context_vars = c("competitor_index", "holiday_flag"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric"  # o "weibull"
)
```

**Rangos de hiperparámetros:**
Robyn busca valores de adstock theta y saturación alpha/K para cada canal dentro del rango especificado. Los rangos por defecto generalmente son suficientes, pero si tienes knowledge del dominio, puedes añadir restricciones:

```r
hyperparameters <- list(
  facebook_spend_alphas = c(0.5, 3),   # pendiente de saturación
  facebook_spend_gammas = c(0.3, 1),   # inflexión de saturación
  facebook_spend_thetas = c(0, 0.5)    # adstock decay (geométrico)
)
```

Ejecución del modelo:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,     # iteraciones del algoritmo genético
  trials = 5,            # cuántas seeds aleatorias
  cores = 4
)
```

Este paso toma 10–30 minutos (según tamaño de datos). Produce un conjunto Pareto-óptimo de modelos — tradeoff entre NRMSE (calidad de ajuste) y DECOMP.RSSD (suavidad en distribución de contribuciones).

**Selección de modelo:** Robyn sugiere 10–20 modelos Pareto. Elegir el NRMSE más bajo no siempre es correcto — algunos modelos pueden overfitting. Con argumento `robyn_clusters` en `robyn_outputs()` puedes agrupar modelos y seleccionar el centro del cluster más estable.

## Validación holdout: medir confiabilidad del modelo

Una de las características más críticas de Robyn es la validación holdout integrada. Mantienes las últimas N semanas fuera del entrenamiento, luego genera predicciones para ese período y compara con valores reales.

```r
# Últimas 8 semanas como holdout
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 4,
  calibration_input = NULL,
  holdout_periods = 8  # últimas 8 semanas como set de test
)
```

Los resultados holdout aparecen en `OutputModels$resultHypParam`:

| Model ID | Train NRMSE | Holdout MAPE | Holdout NRMSE |
|---|---|---|---|
| 1_123_4 | 0.08 | 12.3% | 0.14 |
| 2_456_1 | 0.07 | 18.5% | 0.21 |

**Holdout MAPE < 15%** generalmente se considera listo para producción. Por encima de 20% indica que el modelo tiene poder de forecast débil — o hay problema de calidad de datos o los rangos de hiperparámetros son demasiado amplios.

**Trampa práctica:** Si el período holdout contiene un evento outlier (outage de plataforma, campaña viral), el modelo no puede predecirlo y MAPE se dispara. En ese caso, desplaza el período holdout y prueba nuevamente, o marca esa semana como anomalía.

Un beneficio colateral de validación holdout: oportunidad de cross-check con resultados de pruebas de incrementalidad. Si MMM muestra 30% ROAS para Facebook pero un test geo-split anterior mostró 15%, probablemente MMM esté atribuyendo a Facebook un efecto macroeconómico correlacionado (seasonalidad, trend orgánico). Detectar estas inconsistencias es crítico — por eso en [CDP & retention engineering](https://www.roibase.com.tr/es/retention-engineering-cdp) conectamos MMM output a dashboards de experiments.

## Optimización de presupuesto y planificación de escenarios

Después de construir el modelo Robyn, hay dos casos de uso principales: **reasignación de presupuesto** (distribución óptima por canal) y **what-if scenarios** (qué pasa si aumentamos presupuesto 20%).

**Budget allocator:**

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "1_123_4",  # modelo Pareto seleccionado
  scenario = "max_response",  # o "target_efficiency"
  channel_constr_low = 0.7,   # cada canal min 70% presupuesto actual
  channel_constr_up = 1.5     # máx 150%
)
```

Salida: presupuesto recomendado por canal y revenue incremental esperado:

| Canal | Actual | Recomendado | Delta | Revenue Incremental |
|---|---|---|---|---|
| Facebook | €5K | €4.2K | -16% | -€800 |
| Google Search | €7K | €9.1K | +30% | +€3.2K |
| Display | €3K | €2.7K | -10% | -€200 |

Esta tabla dice: "si asignas 30% más presupuesto a Google Search y reduces Facebook 16%, puedes incrementar revenue total €2.2K". Los parámetros de restricción (low/up) previenen cambios radicales — en práctica, cortar un canal 50% en una noche conlleva riesgo operacional.

**Planificación de escenarios:** Con parámetro `expected_spend` puedes variar presupuesto total y obtener la distribución óptima para ese escenario. Ejemplo: si presupuesto Q4 aumenta 25%, Robyn te da el breakdown de canales para ese scenario.

En proyectos Roibase, exportamos MMM output automáticamente a Google Sheets o Looker Studio — el CMO ve recomendaciones en vivo en reuniones de presupuesto semanal. Exportación JSON:

```r
robyn_write(InputCollect, OutputModels, select_model = "1_123_4", export = TRUE)
```

Genera archivo `Robyn_[timestamp].json` con todos los hiperparámetros, coeficientes y datos de response curve. Puedes leerlo con script Python y crear notificaciones Slack o reportes por email.

## Refresh del modelo y versionado

MMM no es estático — debes refresh cada trimestre con nuevos datos. Robyn tiene capacidad "warm start": usar hiperparámetros del modelo anterior como seed y fine-tune solo con datos nuevos.

```r
# Cargar modelo anterior
InputCollectRefresh <- robyn_refresh(
  json_file = "Robyn_2025Q4.json",
  dt_input = new_data,  # datos últimos 3 meses
  refresh_steps = 1000
)
```

Este approach reduce tiempo de convergencia 60% y minimiza coefficient drift — Facebook's saturasyon curve no cambia 50% de la noche a la mañana, la transición es smooth.

**Best practice de versionado:** En cada refresh, commit el JSON a Git o sube a S3 con timestamp. Así, 6 meses después puedes responder "por qué asignamos menos presupuesto a Google en ese período" consultando model history. En nuestro