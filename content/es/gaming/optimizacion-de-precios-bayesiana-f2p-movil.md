---
title: "Optimización de Precios Bayesiana en F2P Mobile"
description: "Gestión de pruebas de precios IAP con estimación posterior: segmentación, escalera de precios A/B, filtrado de falsos positivos e intervalos de confianza posterior."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: gaming
i18nKey: gaming-002-2026-06
tags: [bayesian-optimization, iap-pricing, f2p-monetization, price-testing, posterior-estimation]
readingTime: 8
author: Roibase
---

En juegos móviles F2P, la optimización de precios IAP aún se realiza con lógica frecuentista de A/B: dos paquetes de precios, 14 días, espera p<0.05. Este enfoque causa pérdida de potencia estadística en segmentos pequeños (usuarios VIP, ballenas nuevas), eliminando la oportunidad de decisiones tempranas. La optimización bayesiana de precios actualiza la distribución posterior, permitiendo tanto decisiones más rápidas como construcción de confianza en muestras pequeñas. Este artículo explica cómo gestionar pruebas de escalera de precios IAP con estimación posterior, límites de segmentación, filtrado de falsos positivos y modelado de aumento de ingresos.

## Dónde falla el A/B frecuentista en pruebas IAP

Las pruebas A/B clásicas requieren un tamaño de muestra fijo. Dado que la tasa de compra de usuarios en IAP oscila entre %2–5, acumular volumen de conversión suficiente en una prueba de precios toma 3–4 semanas. En el segmento ballena (top %1 de gastadores), la tasa es aún más baja, extendiendo el tiempo de prueba a 6 semanas. El problema: el meta del juego cambia, llegan nuevos eventos, terminan períodos estacionales — los datos obtenidos después de 6 semanas ya no son representativos.

La lógica frecuentista además produce decisiones binarias: ganó/perdió. Sin embargo, en pruebas IAP el efecto de la variable de precio no es monótono. Al subir de $4.99 a $6.99, la conversión puede caer %8, pero el average revenue per paying user (ARPPU) sube %22, generando un aumento neto de ingresos de +%12. Este tradeoff no aparece en el valor p frecuentista; requiere cálculo post-hoc.

El enfoque bayesiano combina la creencia prior (por ejemplo, "este segmento típicamente monetiza mejor en el rango $5–7") con los datos para producir una distribución posterior. Comienza a actualizar la posterior desde el primer día del test, entregando resultados preliminares con 500 impresiones. Al poder detener temprano, reduces el tiempo de prueba a la mitad; simultáneamente, con el intervalo de confianza posterior puedes construir una estrategia de decisión agresiva o conservadora basada en riesgo cuantificado.

## Construcción de Prior y Likelihood en pruebas de escalera de precios

Una prueba de escalera de precios IAP tiene esta estructura: precio actual $4.99, variantes a probar $5.99, $6.99. Mantendrás una distribución posterior separada para cada punto de precio: `P(θ | data)` — donde θ = true conversion rate o expected revenue per user (ERPU).

**Selección de Prior:**
La distribución Beta(α, β) es útil para tasas de conversión. Si tienes datos históricos para el segmento (por ejemplo, %3.2 de conversión en los últimos 90 días, 1200 impresiones), lo conviertes a prior como `α = conversiones`, `β = no-conversiones`. Sin datos, usa prior no-informativo Beta(1,1) — distribución uniforme. Para segmentos ballena, generalmente se prefiere prior informativo porque el tamaño de muestra será pequeño; un prior informativo estabiliza la posterior.

**Likelihood:**
Cada variante de precio es un ensayo de Bernoulli. El usuario ve el IAP, compra o no. Datos observados: n impresiones, k conversiones. La actualización posterior es:

```
Posterior = Beta(α + k, β + n - k)
```

Esta fórmula se actualiza cada día conforme llegan nuevas impresiones. Ejemplo de escenario:

| Día | Precio | Impresiones | Conversiones | Posterior |
|-----|--------|-------------|--------------|-----------|
| 1   | $5.99  | 120         | 4            | Beta(5, 117) |
| 3   | $5.99  | 380         | 13           | Beta(14, 368) |
| 7   | $5.99  | 820         | 28           | Beta(29, 793) |

En el día 7, la media posterior = 29/(29+793) = %3.53. Intervalo creíble: [%2.4, %4.9] (%95 HPD).

## Segmentación e integración Multi-Armed Bandit

Ejecutar la prueba de escalera de precios en toda la base de usuarios simultáneamente es ineficiente. Enfócate en segmentos con mayor potencial de ingresos: ballenas nuevas (D7 con primer IAP, gasto >$20), gastadores recurrentes (2+ compras en los últimos 14 días), gastadores disparados por eventos (activados cuando sale el nuevo pase de temporada). Mantener una posterior separada por segmento incrementa la complejidad del modelo pero proporciona ganancia en eficiencia de muestra.

La integración de Multi-Armed Bandit (MAB) con optimización bayesiana permite asignación dinámica: canaliza más tráfico hacia el punto de precio con media posterior más alta (exploit), pero dedica tráfico mínimo a los de varianza posterior alta (explore). El algoritmo Thompson Sampling logra este equilibrio muestreando desde la posterior y seleccionando el valor más alto:

```python
def thompson_sampling(posteriors):
    samples = [beta.rvs(p['alpha'], p['beta']) for p in posteriors]
    return np.argmax(samples)
```

En cada decisión de asignación de impresión, la función anterior se ejecuta. Tras 10.000 impresiones, el punto de precio óptimo acumula naturalmente la mayoría del tráfico, pero otros no desaparecen completamente; si llegan nuevos datos, la posterior se actualiza y puede cambiar la preferencia.

## Filtrado de falsos positivos e intervalo de confianza posterior

En pruebas bayesianas no existe el concepto de "significancia estadística"; se usa probabilidad posterior en su lugar: `P(θ_A > θ_B | data)`. Si esta probabilidad es >%95, decimos que el precio A supera a B. Pero atención: probabilidad posterior alta no implica ganancia operacional si el tamaño del efecto es pequeño.

**Umbral de Minimum Detectable Effect (MDE):**
Si el aumento de ingresos es <%5, el costo de implementación (cumplimiento App Store, agregar SKU nuevo, localización) supera la ganancia. Por eso la regla de decisión debe ser:

```
IF P(uplift > 5%) > 0.95 AND posterior_mean_uplift > 5%:
    DEPLOY
ELSE:
    CONTINUE or STOP
```

Este doble filtro controla falsos positivos. Por ejemplo, si el aumento posterior medio del precio $5.99 es +%3.2 pero el intervalo creíble es [-%1.2, +%7.8], aún es prematuro decidir. Tras acumular datos 2 semanas más, el intervalo se estrecha a [+%2.1, +%5.6] y la media supera %5, entonces se cumple el criterio para deploy.

**Posterior predictive check:**
Tras desplegar el precio optimizado, simula el rendimiento real usando distribución posterior predictiva. Si los ingresos observados caen fuera de esta distribución (por ejemplo, por debajo del percentil %1), la composición del segmento ha cambiado o un factor externo intervino (nuevo juego competidor lanzado, política de precios de Apple cambió). En este caso, invalida la posterior e inicia retest con prior nuevo.

## Modelado de aumento de ingresos y árbol de decisión operacional

El métrica final de una prueba de precios IAP no es tasa de conversión sino aumento de ERPU a nivel de segmento (expected revenue per user). Dentro del framework bayesiano, modela ERPU así:

```
ERPU = P(conversion) × Price
Posterior ERPU = E[θ] × Price
```

Calcula el ERPU posterior para cada punto de precio, selecciona el más alto. Pero existe tradeoff: precio alto reduce conversión, precio bajo reduce ARPPU. Para encontrar el punto óptimo, prueba toda la escalera simultáneamente (3–4 variantes), compara las distribuciones posteriores de ERPU.

**Árbol de decisión operacional:**

1. **Día 3:** ¿La varianza posterior aún es alta? Sí → ajusta asignación de tráfico (MAB). No → verifica si hay señal de ganador temprano.
2. **Día 7:** ¿La probabilidad posterior del mejor punto de precio es >%90? Sí → lanzamiento suave (segmento ballena %10). No → continúa 7 días más.
3. **Día 14:** ¿El intervalo creíble posterior es estrecho (rango <%3) y el aumento >%5? Sí → deploy completo. No → test inconcluso, realiza análisis de meta.

Este árbol acelera el cierre de pruebas a mediana 10 días (vs 21 en frecuentista). Incluso en segmentos estrechos como ballenas, el día 14 permite decisión porque con prior informativo, la posterior se estrecha rápidamente.

Análisis de meta: si el test resulta inconcluso, microdivide dentro del segmento (iOS vs Android, geo tier-1 vs tier-2, edad D7 vs D30). Calcula posterior por cada uno, identifica dónde la señal es fuerte, aplica precio específico a ese subsegmento. Este proceso paralela la lógica de [App Store Optimization](https://www.roibase.com.tr/es/aso): cada segmento ve creativo diferente; aquí, ve precio diferente.

## Calibración de precios a largo plazo con estimación posterior

La optimización bayesiana de precios no es prueba única sino sistema de calibración continua. Cada mes llegan cohortes nuevas, el meta cambia, efectos de eventos estacionales modifican la posterior. Para esto, aplica lógica de posterior rodante: actualiza la posterior cada semana con datos de últimos 60 días, difumina el prior antiguo (exponential decay).

```python
def update_rolling_posterior(current_posterior, new_data, decay=0.95):
    alpha_new = current_posterior['alpha'] * decay + new_data['conversions']
    beta_new = current_posterior['beta'] * decay + new_data['non_conversions']
    return {'alpha': alpha_new, 'beta': beta_new}
```

Este sistema no reinicia la posterior tras cambio de precio, sino integra data del nuevo precio a la posterior existente. Así, información pasada no desaparece completamente pero el patrón actual obtiene mayor peso.

A largo plazo, extraes una curva de elasticidad de precios: grafica media posterior ERPU para cada punto de precio, ajusta con curva fitted, observa efecto marginal de cada $1 de aumento. Si la curva meseta en $6.99, no pruebas precios más altos; en cambio, experimenta con estrategia de bundle/paquete (2 IAP juntos con %15 descuento). Esta estrategia también se prueba bayesianamente, tomando prior de tasa de conversión bundle como %70 del IAP único (heurística de industria), luego actualiza con datos posteriores.

La optimización bayesiana de precios transforma pruebas estáticas de IAP en sistema de aprendizaje dinámico. Con estimación posterior, tomas decisiones tempranas en segmentos pequeños, controlas falsos positivos mientras maximizas aumento de ingresos. En poblaciones estrechas como ballenas o gastadores disparados, frequentista no funciona; la estructura prior + likelihood de bayesiano resuelve este problema. Con posterior rodante, la calibración de precios se actualiza continuamente; cambios estacionales o shifts de meta se reflejan automáticamente. Resultado: tiempo de prueba a la mitad, calidad de decisión superior, costo operacional reducido.