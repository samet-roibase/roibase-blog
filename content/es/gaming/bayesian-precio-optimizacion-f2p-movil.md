---
title: "Optimización de Precios Bayesiana en F2P Mobile"
description: "Optimizar escalas de precios IAP con tests Bayesianos: estimación posterior, pricing basado en segmentos y metodología de cálculo de revenue lift."
publishedAt: 2026-08-05
modifiedAt: 2026-08-05
category: gaming
i18nKey: gaming-002-2026-08
tags: [f2p-monetization, bayesian-testing, iap-optimization, price-ladder, mobile-gaming]
readingTime: 8
author: Roibase
---

En juegos F2P móviles, la optimización de precios IAP suele reducirse a A/B testing: compara dos precios, elige el de mayor revenue. Este enfoque funcionaba en 2018 porque el costo de UA era bajo y no había problemas de sample size. En 2026 la situación es diferente: tras iOS 14.5 el tracking de cohortes está roto, el CPI en Apple Search Ads aumentó %340, los tiempos de test pasaron de 8 a 14 semanas. La metodología Bayesiana ofrece dos ventajas en estas condiciones: con la distribución posterior se pueden tomar decisiones tempranas, y la segmentación refuerza el modelo con información previa. En la economía de los juegos, la elasticidad de precio no es constante — se comporta diferente en segmentos whale/dolphin/minnow, y capturar esta diferencia está fuera del alcance del A/B frecuentista.

## La Lógica Económica de los Tests Bayesianos

En F2P móvil, el costo de un test de precio no es solo tiempo de desarrollo, sino costo de oportunidad. Si pruebas $4.99 versus $6.99 y esperas 14 semanas, el revenue perdido mientras encuentras el precio correcto es el costo mismo del test. El enfoque Bayesiano actualiza la distribución posterior cada día — en lugar de una tasa de conversión de %2.3, tienes un intervalo creíble del 95% de %1.8 a %2.9. Conforme el intervalo se estrecha, la decisión se vuelve clara y puedes terminar el test temprano.

En A/B frecuentista calculas un tamaño mínimo de muestra para p-value <0.05 y esperas hasta alcanzarlo. Pero en gaming móvil, el tamaño de cohorte fluctúa diariamente: un nuevo feature launch suma +%40 DAU, seasonalidad de verano resta -%25. El modelo Bayesiano interpreta estas fluctuaciones como actualizaciones de prior, no se queda atrapado en un plan de sample size fijo.

Ejemplo práctico: en un juego con 10,000 DAU pruebas starter pack a $9.99. El cálculo frecuentista necesita 42,000 usuarios para detectar +%5 de revenue lift en 6 semanas. El modelo Bayesiano en la semana 3 muestra posterior mean de $11.2 ARPPU (control $10.8), intervalo de confianza 95% sin superposición — decisión tomada, test cerrado. Recuperaste 3 semanas de revenue perdido.

### Selección de Prior y Segmentación

En tests Bayesianos, elegir la distribución prior no es subjetivo sino basado en datos históricos. Si el año pasado probaste 8 price points entre $4.99 y $9.99 en un juego similar, extraes una distribución beta de esos datos. El prior puede ser débil (varianza alta) pero es mejor que un prior uniforme no informativo, porque sabes que la tasa de conversión whale no cae por debajo de %0.5.

La segmentación fortalece el prior: para nuevos usuarios usas un prior no informativo, para usuarios con 30+ días de retention usas un prior ajustado. El modelo Bayesiano jerárquico estima parámetros a nivel de segmento y globales simultáneamente — cada segmento usa sus propios datos pero también la tendencia global se comparte. Este enfoque evita overfitting en segmentos pequeños.

## Arquitectura de la Escalera de Precios IAP

En juegos F2P la escalera de precios no es plana sino distribuida logarítmicamente: $0.99, $2.99, $4.99, $9.99, $19.99, $49.99, $99.99. Estos saltos tienen base psicológica (charm pricing) pero la razón económica es más fuerte: cada escalón captura un segmento diferente de willingness-to-pay. En optimización Bayesiana cada escalón tiene su propio posterior e influyen entre sí — si subes $4.99, la conversión en $2.99 puede bajar (degradación), pero $9.99 sube (upgrading).

En un test de escalera completa no optimizas un precio único sino toda la estructura. Un algoritmo multi-armed bandit ve cada punto de precio como un brazo, y Thompson Sampling muestrea del posterior actual para elegir el que genera mayor revenue esperado. En las primeras 2 semanas todos los brazos explotan equitativamente, desde la semana 3 en adelante según aumenta la confianza en el posterior, la explotación toma peso.

Escenario de ejemplo: escalera de 7 puntos, test de 21 días. Primeros 7 días cada precio recibe %14 del tráfico (distribución uniforme). A partir del día 8, el precio con mayor media posterior × tasa de conversión atrae tráfico. En el día 21: $4.99 recibe %40 del tráfico, $9.99 %25, otros %5-10. En la decisión final ambos $4.99 y $9.99 se mantienen porque generan revenue marginal positivo sin canibalizarse mutuamente.

### Pricing Basado en Segmentos

El mismo precio no funciona para whale/dolphin/minnow porque la elasticidad de precio difiere. Usuarios whale (top %1 en gasto) ven su conversión bajar solo %3 si el precio de $99.99 sube %20 — inelástico. Usuarios minnow (los que compran $0.99 en primeros 7 días) ven caída de %18 con alza de %10 — elástico. El modelo Bayesiano codifica esta elasticidad en el prior a nivel de segmento.

Las características para segmentación son: días desde install (D1/D7/D30), gasto total acumulado, tiempo desde último IAP, frecuencia de sesiones, progresión en niveles. De estas features construyes un prior de segmento latente — el modelo jerárquico también estima la membresía de segmento. Así cuando llega un usuario nuevo, sus primeras 24 horas de comportamiento estiman su segmento y se le muestra el precio calibrado.

En los trabajos de [App Store Optimization](/es/aso) de Roibase también se usa segmentación similar: resultados de tests creativos varían por segmento de usuario, el mismo creativo en iOS 16+ genera %8 IPM mientras en iOS 15 solo %3. Cuando ASO se integra con optimización IAP, logras integridad en el funnel — mostrar el precio correcto al usuario correcto requiere primero atraer al usuario correcto.

## Estimación Posterior y Mecanismo de Decisión

En un test Bayesiano la métrica de decisión es posterior probability of superiority: $P(\text{tratamiento} > \text{control} | \text{datos})$. Cuando esta probabilidad supera %95 el tratamiento gana. La diferencia con p-value frecuentista: p-value mide la extremidad de los datos bajo hipótesis nula, la probabilidad posterior mide directamente "la probabilidad de que el tratamiento sea mejor".

Para calcular el posterior, si usas prior conjugado hay solución analítica (beta-binomial), de lo contrario necesitas simulación MCMC (Markov Chain Monte Carlo). En tests de gaming móvil combinas binomial para conversión + lognormal para revenue — prior beta para conversión, prior lognormal para revenue. Con PyMC3 o Stan, 10,000 iteraciones MCMC tardan 30 segundos, actualizar posterior con datos diarios es directo.

El threshold de decisión puede ser %95 o %90 — en fases de growth agresivo %90 es suficiente, en juegos maduros se usa %95. Cuando el threshold baja, sube el riesgo de falso positivo pero baja el tiempo de test. El cálculo de Expected Value of Information (EVI) encuentra el threshold óptimo: equilibra costo de test una semana más versus riesgo de decisión equivocada.

### Estructura de Test Bayesiano Multi-Variante

Un test de precio IAP típicamente incluye 3+ variantes: control ($4.99), tratamiento A ($5.99), tratamiento B ($6.99). En A/B frecuentista hay problema de múltiples comparaciones, corrección Bonferroni multiplica el tamaño de muestra. En Bayesiano cada variante tiene su propio posterior, las comparaciones pairwise ocurren simultáneamente. En lugar de elegir el posterior mean más alto, maximizas revenue esperado: cada variante gana con probabilidad × revenue esperado.

Thompson Sampling: cada día muestrea del posterior de cada variante una vez, envía tráfico a la muestra más alta. Esta estrategia balancea automáticamente exploración/explotación — cuando la incertidumbre posterior es alta (días iniciales) el tráfico se distribuye uniformemente, luego se concentra en la variante ganadora.

Snippet de código (modelo beta-binomial con PyMC3):

```python
import pymc3 as pm

with pm.Model() as iap_model:
    # Prior: uniform beta
    p_control = pm.Beta('p_control', alpha=1, beta=1)
    p_treatment = pm.Beta('p_treatment', alpha=1, beta=1)
    
    # Likelihood
    obs_control = pm.Binomial('obs_control', n=n_control, p=p_control, observed=conversions_control)
    obs_treatment = pm.Binomial('obs_treatment', n=n_treatment, p=p_treatment, observed=conversions_treatment)
    
    # Posterior sampling
    trace = pm.sample(10000, return_inferencedata=False)
    
    # Probability of superiority
    prob_superiority = (trace['p_treatment'] > trace['p_control']).mean()
```

Este modelo optimiza tasa de conversión. Para optimización de revenue añades prior lognormal y calculas posterior conjunto de `p × revenue_mean`.

## Migración de Segmentos e Impacto a Largo Plazo

La optimización de precios no es un test único sino proceso continuo. Los usuarios cambian de segmento: un minnow hoy es dolphin en 30 días. El modelo Bayesiano con prior estático no captura esta migración. La solución: dynamic prior update — cada 30 días el posterior se combina con datos nuevos para convertirse en el nuevo prior.

Para medir impacto a largo plazo modeleas la curva de retención de cohortes con Bayesian survival analysis. Si el cambio de precio reduce retención D7 en %2 pero sube LTV de $12 a $14, es neto positivo. El modelo de supervivencia usa distribución Weibull para estimar parámetros shape y scale, validación predictiva posterior te da forecast de LTV a 90 días.

El test de impacto en retención toma 6-8 semanas porque necesitas esperar la señal de retención D30. El enfoque Bayesiano predice D30 desde datos D7 — usa como prior la tasa D7→D30 de cohortes pasadas. Así en la semana 3 tienes señal temprana: si el posterior mean de retención D30 es %18 con intervalo 95% [%16, %20], continúas; si es [%14, %16], el cambio de precio quiebra retención, detienes y revertes.

## Economía del Juego y Dinámicas de Plataforma

Usuarios iOS y Android responden diferente a la misma escalera. Usuarios iOS promedian %23 ARPPU más alto, el mismo precio $4.99 genera %3.2 conversión en iOS pero %2.1 en Android. El modelo Bayesiano añade plataforma como factor jerárquico — cada una tiene su propio prior de segmento pero la tendencia global es compartida.

El sistema de pricing tiers de Apple Store (Tier 1 = $0.99, Tier 5 = $4.99...) limita flexibilidad. Testas entre Tier 3/4/5 con grid search en lugar de posterior, eligiendo el que maximiza revenue esperado posterior. Google Play es más flexible (precios arbitrarios) pero conversión es más volátil — en tests Android la varianza prior se establece %30 más amplia.

Las fluctuaciones de moneda también impactan el posterior: si el precio en Türkiye es ₺49.99 y el dólar sube de ₺25 a ₺35, el precio real cae de $2 a $1.43. El modelo usa revenue ajustado por moneda, posterior se calcula en base USD. Para mercados emergentes, pricing PPP-ajustado requiere prior separado — el mismo juego puede costar $4.99 en EE.UU. y R$9.90 en Brasil (~$1.80 con paridad de poder adquisitivo).

En el contexto del [Programa de Editor Premium](/es/premiumyayinci), las campañas de UA alimentan los resultados de tests de precio: para segmentos de alto LTV subes CPM bidding, para segmentos de conversión baja bajas bids. Cuando integras el modelo Bayesiano IAP con estrategia de bidding en UA, logras optimización ROI a nivel de portfolio — el output del modelo define qué segmento de usuario a qué precio y con qué CPI máximo obtener UA.

---

La optimización de precios en F2P móvil ya no se reduce a "qué precio es mejor". Elasticidad basada en segmentos, diferencias de plataforma, impacto en retención, riesgo de divisa — todo se encaja en el framework prior/posterior Bayesiano y permite decisión temprana. Sin embargo, implementar un test Bayesiano es más complejo que A/B frecuentista — requiere data pipeline, infraestructura MCMC, tuning de prior. El cálculo ROI es directo: si corres 2+ tests de precio mensuales y cierras en 2 semanas en lugar de 4, el tiempo ahorrado cubre el costo del modelo. Construir toma 1 sprint, mantener 2 horas de analytics semanales — el trade-off es neto positivo.