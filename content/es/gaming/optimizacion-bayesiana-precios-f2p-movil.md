---
title: "Optimización Bayesiana de Precios en Mobile F2P"
description: "IAP con estimación posterior y optimización segmentada: modelo probabilístico para balance conversion, revenue y LTV en juegos móviles."
publishedAt: 2026-05-26
modifiedAt: 2026-05-26
category: gaming
i18nKey: gaming-002-2026-05
tags: [monetizacion-f2p, pruebas-bayesianas, optimizacion-iap, price-ladder, juegos-moviles]
readingTime: 8
author: Roibase
---

En juegos mobile F2P, el pricing de IAP sigue siendo guiado por intuición: el ladder $0.99, $4.99, $9.99 se copia, si la conversión baja se reduce el precio, si sube se añade "más valor". Pero el mismo pack de $4.99 puede mostrar 2.1% de conversión en usuarios orgánicos, 1.4% en cohorts de UA, y 8.7% en whales D30+. El test A/B clásico falla aquí: o el sample size se dispara, o la espera llega a 6 semanas, o no está claro qué métrica optimizar (revenue vs. conversión). La optimización Bayesiana de precios resuelve estos tres problemas simultáneamente: captura señales tempranas con distribuciones posteriores, modela el impacto LTV a nivel segmento, gestiona el equilibrio revenue-conversión en un marco probabilístico.

## El Cuello de Botella del A/B Frequentist en Pricing de IAP

Un test A/B estándar calcula el tamaño de muestra basándose en conversion rate para detectar una diferencia p<0.05 entre dos precios. Baseline del 2% de conversión, objetivo de 10% de lift relativo, power del 80% requieren ~15.000 exposiciones. Para un IAP de gama media, esto representa 4-6 semanas. A medida que se prolonga el test:

- Los CPIs en campañas Meta suben (fatiga creativa)
- El mix de cohorts orgánicos cambia (efecto estacional, cambios en ranking ASO)
- Un juego rival lanza nuevo evento, la elasticidad de demanda se rompe

El problema más crítico es el split revenue-conversión: pasar de $2.99 a $4.99 reduce conversión de 2.1% a 1.7%, pero sube revenue por mille un 42%. ¿Sobre qué métrica se calcula el p-value? Muchos estudios dirán "ganamos revenue" y avanzan, pero cuando se modelan LTVs a 7 días, descubren que el segment whale sufre 31% de churn y la nueva tarifa daña la retención.

El enfoque Bayesiano mantiene conversión y revenue en el mismo modelo posterior: creencia previa (distribución beta de tests anteriores) + observación (datos nuevos) → posterior (creencia actualizada). Desde el día 3 el test puede decir "hay 73% de probabilidad de que $4.99 sea mejor", al día 7 sube a 89%, y al día 10, cuando el remordimiento cae por debajo de 1%, se detiene el test.

## Construcción de Prior: Datos Históricos en Lugar de Benchmarks

La calidad del test Bayesiano depende de construir bien el prior. Mucha documentación dice "toma un prior uniforme, que hable el data", pero si tienes 6 meses de historia IAP en mobile F2P, desperdiciar esa fuente es irracional. Proceso de construcción de prior:

**Paso 1:** Extrae la distribución de conversion rates de todos los tier de IAP en los últimos 6 meses. El rango $0.99-$2.99 muestra conversión de 1.8%-3.2%, mediana 2.4%. Los parámetros beta distribution que reflejan esto son alpha=24, beta=976 (media=alpha/(alpha+beta)≈0.024).

**Paso 2:** Añade varianza a nivel segmento. El cohort orgánico muestra conversión 18% más alta que el cohort UA (alpha=28, beta=972). Para usuarios whales D30+: conversión 6.8%, alpha=68, beta=932.

**Paso 3:** Fit de curva elasticidad de precios. Datos históricos muestran que el cambio $1.99 → $2.99 redujo conversión un 14% en promedio. Si el nuevo test es $2.99 → $3.99, codifica este slope en el prior:

```python
def price_elasticity_prior(base_price, new_price, base_conversion):
    slope = -0.14 / 1.00  # Caída 14% por $1 de aumento
    delta = new_price - base_price
    expected_drop = slope * delta
    adjusted_conversion = base_conversion * (1 + expected_drop)
    alpha = adjusted_conversion * 1000
    beta = 1000 - alpha
    return alpha, beta
```

Este enfoque refleja el comportamiento de cada cohort del juego, no un benchmark externo "conversión industria 2.5%".

## Estimación Posterior con Optimización Segmentada de Price Ladder

Setup del test: starter pack $2.99 vs. $3.99, 7 días dirigido al tráfico UA con split 50/50. Pero la segmentación es obligatoria:

| Segmento | Prior α | Prior β | Sample size objetivo |
|----------|---------|---------|----------------------|
| D0-D7 orgánico | 28 | 972 | 4000 |
| D0-D7 UA | 22 | 978 | 6000 |
| D7+ no pagador | 18 | 982 | 3000 |
| D7+ comprador previo | 68 | 932 | 2000 |

El posterior se actualiza por separado en cada segmento. Resultados al día 3:

**Segmento orgánico:** $2.99 → 87 conversiones / 2100 exposiciones, $3.99 → 71 / 2050. Posterior: α₁=28+87=115, β₁=972+2013=2985 vs. α₂=28+71=99, β₂=972+1979=2951. Con 10.000 muestras Monte Carlo, P($2.99 mejor) = 78%. En revenue: $2.99 × 87 = $260, $3.99 × 71 = $283. Si se modela el posterior de revenue con distribución gamma, P($3.99 superior en revenue) = 61%.

En este punto la decisión: si la prioridad es conversión, mantén $2.99; si es revenue, espera 2 días más. En el segmento UA, $3.99 es claramente superior (83% posterior probability), el test se detiene temprano y ese segmento se reorienta a $3.99.

**Construcción dinámica del price ladder por segmento:** Cuando termina el test, el inventario IAP queda:

- Orgánico D0-D3: starter $2.99
- UA D0-D3: starter $3.99
- D7+ comprador previo: booster $7.99 (del posterior del test separado)
- Whale (D30+ $50+ LTV): premium bundle $14.99

Esta estructura optimiza 4 curvas de elasticidad diferentes, no un precio global único. Si se combina con [optimización de ASO](https://www.roibase.com.tr/es/aso) en estrategia de custom product pages, el funnel de IAP se personaliza aún más: el value proposition en el creativo coincide con el tier de IAP.

## Thompson Sampling para Extensión Multi-Armed Bandit

En lugar de un test fijo de 7 días, extensión Thompson sampling: cada impression muestrea desde el posterior del segmento y muestra el precio con mayor valor esperado. Así el equilibrio exploration/exploitation se construye dinámicamente durante el test.

Pseudocódigo:

```python
def thompson_sampling_price(segment, price_variants):
    posteriors = {p: get_posterior(segment, p) for p in price_variants}
    samples = {p: np.random.beta(post['alpha'], post['beta']) 
               for p, post in posteriors.items()}
    revenue_samples = {p: s * p for p, s in samples.items()}
    return max(revenue_samples, key=revenue_samples.get)
```

Este enfoque es especialmente valioso cuando se prueban 3+ variantes de precio. Un A/B clásico con 3 precios requiere 3× el tamaño de muestra; Thompson sampling actualiza el posterior y elimina automáticamente variantes pobres. Al día 10, si el posterior de $2.99 cayó al 9%, la proporción de exposición cae al 5%, no hay desperdicio de sample.

Advertencia: si la fuente UA no es ilimitada, Thompson sampling corre riesgo de agotamiento presupuestario. Si el presupuesto diario de Meta es $5000, el precio elegido por Thompson reduce conversión, CPA sube, presupuesto se agota al mediodía. Setup seguro: primeros 3 días split 50/50, cuando credibilidad posterior cruza 80%, abre Thompson.

## Revenue vs. LTV: Integración del Posterior con Modelo de Retención

La capa final de optimización Bayesiana de precios es proyección LTV. Si $3.99 muestra conversión baja pero D7 retention 8% más alta, el LTV a 90 días del cohort podría superar al cohort de $2.99. El A/B clásico no lo ve porque LTV se cristaliza en 90 días. Un posterior Bayesiano integrado con survival model lo captura temprano.

Setup: Cada variante de precio obtiene un fit de curva de retención en primeros 7 días usando Cox proportional hazard model:

```python
from lifelines import CoxPHFitter

df['price_variant'] = df['variant'].map({'2.99': 0, '3.99': 1})
cph = CoxPHFitter()
cph.fit(df, duration_col='days_retained', event_col='churned', 
        formula='price_variant + segment + paid_d3')
```

Output del modelo: variante $3.99 hazard ratio 0.88 (churn 12% menor, p=0.03). Integra esto con el posterior:

**Cálculo del posterior LTV:**
- $2.99: E[conversión]=0.024, E[D90_retención]=0.34, ARPDAU=$0.12 → LTV=$2.99 × 0.024 + 90 × 0.34 × 0.12 = $3.74
- $3.99: E[conversión]=0.019, E[D90_retención]=0.38, ARPDAU=$0.15 → LTV=$3.99 × 0.019 + 90 × 0.38 × 0.15 = $5.21

Con 10.000 iteraciones Monte Carlo, distribución posterior LTV: P(LTV $3.99 superior) = 91%. Esta credibilidad posterior es un señal mucho más fuerte que analizar solo revenue. Decisión: elige $3.99, reequilibra el stack de IAP.

## Tradeoff: Complejidad del Modelo vs. Velocidad de Ejecución

La optimización Bayesiana de IAP carga tres costos operacionales:

**1. Mantenimiento de prior:** Cada nuevo evento, cambio de meta, lanzamiento de competidor altera la distribución prior. Re-calibración obligatoria cada 6 meses. Sin data scientist en el equipo, esto no es sostenible.

**2. Granularidad segmentada:** 8 segmentos × 3 precios = 24 posteriors a seguir. Sample size pequeño en segmentos (ej. whales) mantiene alta varianza posterior, intervalos de confianza anchos. Solución práctica: extrae segment whale, mantén A/B clásico, Bayesiano para los otros.

**3. Fragmentación de plataforma:** iOS vs. Android tienen sensibilidad de precios diferente. En App Store de Apple conversión 23% más alta que en Android (App Annie 2025). ¿Posteriors separados o pooled? Si separados, muestra split; si pooled, bias de plataforma. Solución: Bayesian jerárquico — plataforma como efecto aleatorio.

Aun así, Bayesian es más rápido que esperar A/B por 4+ semanas. Test termina en 10 días, impacto revenue visible en semana 2, proyección LTV actualizada en día 30. Con Frequentist, esta timeline es 8-12 semanas.

## Conclusión: Mentalidad de Pricing Probabilístico

En mobile F2P, el test de precios ya no es binario, es un proceso continuo de actualización de posterior. En lugar de resolver conversión y revenue con p-values separados, modelarlos juntos en marco probabilístico minimiza regret, acorta tiempo de test, permite optimización a nivel segmento. Bayesian requiere disciplina en construcción de prior, pero ofrece derecho a decisión temprana, integración LTV, dynamic allocation vía Thompson sampling. Si tu stack de IAP es 5+ tiers y presupuesto UA supera $100K/mes, la infraestructura de test Bayesiano ya no es opcional.