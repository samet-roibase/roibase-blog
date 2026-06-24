---
title: "Optimización de Precios Bayesiana en F2P Móvil"
description: "Optimiza pruebas de IAP con estimación posterior. Segmentación, duración de prueba, trade-offs de conversión — framework real para aumentar ingresos en F2P."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: gaming
i18nKey: gaming-002-2026-06
tags: [monetizacion-f2p, optimizacion-bayesiana, pruebas-iap, juegos-moviles, estrategia-precios]
readingTime: 8
author: Roibase
---

En juegos F2P móviles, la optimización de precios todavía se hace con lógica de A/B test clásica: dos puntos de precio, 7-14 días, elegir ganador. Pero si la conversion sube de %2.8 a %3.1, ¿eso es realmente ganancia o perdiste el segmento whale y bajaste el LTV general? Las pruebas frequentist A/B te dicen "qué variante ganó" pero no responden "qué precio debería mostrar a qué usuario, en qué momento". La optimización bayesiana de precios cierra ese vacío — actualizando tu ladder de IAP sobre distribuciones posteriores, optimizas conversion y revenue específico de segmento al mismo tiempo.

## Por Qué el A/B Test Frequentist Es Insuficiente en F2P

El test clásico A/B funciona con dos supuestos: (1) el comportamiento de usuario es estable durante la prueba, (2) la variante ganadora es óptima para todos los segmentos. En F2P, ambos son falsos. El comportamiento varía entre las primeras 72 horas, el día 7 y el día 30 — el mismo precio tiene rendimiento diferente en cohortes de retención distintas. Un ejemplo: el starter pack de $4.99 convierte %3.5, la variante $9.99 %2.8 — con lógica A/B clásica, $4.99 gana. Pero el análisis de LTV a 30 días mostró que $9.99 genera %42 más lifetime spend en whales (top %5 de spenders). El test frequentist no lo ve porque no estima posterior por segmento.

El segundo problema es la duración fija de la prueba. A/B corre 14 días, luego decides — pero quizás no llegaste a suficiente poder estadístico en el día 14. Con Bayesian, la distribución posterior se actualiza continuamente; cuando llega suficiente confianza, paras temprano, o si hay ambigüedad, la alargas. Crítico en F2P porque el calendario de live ops no espera — llega nuevo evento, el contexto de precios cambia, tu resultado de prueba envejece.

El tercer problema es la decisión binaria. Frequentist te dice "A ganó", pero en F2P no hay ganador único — el precio correcto es el que se muestra al segmento correcto, en el momento correcto. La optimización bayesiana da, gracias a la estimación posterior, el rango de precio óptimo para cada segmento, que alimenta el motor de pricing dinámico.

## Test de Ladder IAP Bayesiano: Optimización Iterativa con Estimación Posterior

La optimización bayesiana de precios funciona en tres capas: distribución prior (datos de pruebas previas + conocimiento del dominio), función de likelihood (datos de conversión actual), distribución posterior (su producto — creencia actualizada). En pruebas de precio IAP, se aplica así:

**Establecer el prior:** Tienes datos de tests de precio previos. Por ejemplo, tu prior de conversion para IAP de $4.99 es Beta(120, 3800) — 120 conversiones, 3800 impresiones. Este prior es el baseline de tu juego. Si vas a agregar $6.99 al test, construye el prior con conocimiento del dominio: cuando el precio sube %40, la conversión típicamente baja %25-35 (elasticidad entre -0.6 y -0.9). Tu prior podría ser Beta(80, 3840).

**Actualización de likelihood:** La prueba comienza, cada día llegan nuevos datos de conversión. Bayesian actualiza la posterior cada día. En el día 3, la variante $6.99 muestra 45 conversiones, 1200 impresiones — likelihood Beta(45, 1155). Posterior = prior × likelihood = Beta(125, 4995). Te da una estimación de conversión actual: 125/(125+4995) ≈ %2.44. Lo importante: no es solo un punto, es una distribución — intervalo de credibilidad %95 es [%2.1, %2.8]. Es decir, hay %95 de probabilidad que la conversión esté entre %2.1 y %2.8.

**Asignación dinámica con Thompson Sampling:** En A/B clásico, el tráfico se divide %50-%50. En optimización bayesiana usas Thompson Sampling: en cada impresión, muestrea de la distribución posterior, muestra la variante con mayor revenue esperado. Así, conforme avanza la prueba, más tráfico va a la variante con mejor performance, pero no 100% — sigue explorando. Crítico en F2P porque el segmento whale es pequeño pero alto valor; si lo cortas temprano, lo pierdes.

Ejemplo de código (Python + PyMC):

```python
import pymc as pm
import numpy as np

# Prior: conversión IAP $4.99
prior_alpha_499 = 120
prior_beta_499 = 3800

# Variante $6.99 — nueva prueba
conversions_699 = 45
impressions_699 = 1200

with pm.Model() as price_test:
    # Actualización de posterior
    conv_rate_699 = pm.Beta('conv_rate_699', 
                             alpha=prior_alpha_499*0.7 + conversions_699,
                             beta=prior_beta_499*1.0 + (impressions_699 - conversions_699))
    
    # Expectativa de revenue (precio IAP × conversión)
    expected_revenue = conv_rate_699 * 6.99
    
    # Sampling
    trace = pm.sample(2000, return_inferencedata=True)

# Intervalo de credibilidad %95
print(pm.summary(trace, var_names=['conv_rate_699']))
```

Este enfoque te dice: "En el día 3, la conversión de $6.99 está entre %2.1-2.8, revenue esperado $0.17/usuario" — conforme avanza la prueba, el intervalo se estrecha.

## Ladder de Precios por Segmento: Optimización Whale, Dolphin, Minnow

En F2P, no todos los usuarios reaccionan igual a un precio. Si no haces estimación posterior por segmento, optimizas conversion promedio pero pierdes revenue específico de segmento. Tres segmentos base:

**Whale (top %5 de gastadores):** LTV $200+, IAP count 8+, retención D30 %85+. Este segmento tiene baja sensibilidad al precio — si $9.99 convierte %15 menos pero lifetime spend es %60 mayor, sigue siendo ganancia. La estimación posterior aquí responde: "¿$9.99 es óptimo para whales, o $14.99 genera mayor LTV?". Rastrearás la conversión de whale cohort por separado, la posterior se actualiza whale-específica. Ejemplo: conversión general de $9.99 es %2.8, pero en segmento whale %6.2 — para este segmento deberías probar un price point más alto.

**Dolphin (mid %25 gastadores):** LTV $20-50, IAP count 2-4, retención D30 %50-70. Sensibilidad de precio media. En el segmento dolphin, la prueba bayesiana típicamente encuentra rango de precio óptimo: entre $4.99 y $6.99, cuál genera mayor revenue esperado. La distribución posterior puede ser bimodal — algunos dolphin actúan como whale (weekend spiker), otros driftan hacia minnow. Refinamiento de segmentación necesario.

**Minnow (resto, ~%70):** LTV <$10, mayoría non-payer. Sensibilidad de precio muy alta — cambiar de $2.99 a $4.99 puede variar conversion %40. En este segmento, la prueba bayesiana típicamente muestra: el price point más bajo ($0.99-$1.99) maximiza conversion pero total revenue es bajo. Estrategia: usa $0.99 como "impulse buy" para que minnow entre al primer IAP, luego ve a ladder $4.99.

Para estimación posterior por segmento usas modelo bayesiano jerárquico:

```python
with pm.Model() as hierarchical_price:
    # Prior de conversión global
    global_alpha = pm.Gamma('global_alpha', alpha=2, beta=0.1)
    global_beta = pm.Gamma('global_beta', alpha=2, beta=0.1)
    
    # Conversión específica de segmento
    conv_whale = pm.Beta('conv_whale', alpha=global_alpha, beta=global_beta)
    conv_dolphin = pm.Beta('conv_dolphin', alpha=global_alpha, beta=global_beta)
    conv_minnow = pm.Beta('conv_minnow', alpha=global_alpha, beta=global_beta)
    
    # Likelihood (datos de segmento)
    whale_obs = pm.Binomial('whale_obs', n=200, p=conv_whale, observed=12)
    dolphin_obs = pm.Binomial('dolphin_obs', n=800, p=conv_dolphin, observed=24)
    minnow_obs = pm.Binomial('minnow_obs', n=3000, p=conv_minnow, observed=60)
    
    trace = pm.sample(3000)
```

Este modelo liga las conversiones whale, dolphin, minnow con un prior global — incluso con tamaño de muestra pequeño, da estimaciones razonables.

## Duración de Prueba y Stopping Rule: Decisión con Probabilidad Posterior

En A/B clásico, la duración se fija por adelantado (14 días, mínimo 1000 conversiones). En optimización bayesiana, la stopping rule se construye sobre probabilidad posterior: "¿Qué probabilidad tiene la Variante A de ser mejor que la B? ¿Pasó %95?". Esta parada dinámica da ganancia temprana y reduce riesgo de falso positivo.

**Ejemplo de stopping rule:** Prueba $4.99 vs $6.99 IAP. La posterior se actualiza cada día. En el día 5 calculas probabilidad posterior:

```python
# Muestras posterior
samples_499 = trace.posterior['conv_rate_499'].values.flatten()
samples_699 = trace.posterior['conv_rate_699'].values.flatten()

# Comparación de revenue (precio × conversión)
revenue_499 = samples_499 * 4.99
revenue_699 = samples_699 * 6.99

# Probabilidad de que $6.99 sea mejor
prob_699_better = (revenue_699 > revenue_499).mean()
print(f"P($6.99 > $4.99) = {prob_699_better:.2%}")
```

Día 5: P($6.99 > $4.99) = %73 — no decidas aún. Día 9: %94 — aún bajo umbral %95. Día 12: %96 — para la prueba, $6.99 es óptimo. Este enfoque ahorra 2-5 días vs frequentist.

**Duración mínima de prueba:** Incluso si Bayesian permite parada temprana, corre mínimo 7 días en F2P — la primera semana tiene spike de retención, comportamiento de weekend spender, efecto de evento. Si paras antes de 7 días, la posterior está sesgada.

**Minimización de regret:** Con Thompson Sampling, durante la prueba das tráfico a la variante subóptima (exploración). Regret = revenue óptimo - revenue actual. El framework bayesiano minimiza regret porque conforme la posterior se actualiza, exploración baja, explotación sube. En prueba de 14 días: primeros 5 días ~%30 regret, últimos 5 días ~%5 — promedio %15. En A/B clásico, siempre %50 split traffic, promedio regret %25-30.

## Ir a Producción: Motor de Pricing Dinámico y Refinamiento Posterior

La prueba terminó, $6.99 ganó — pero no termina ahí. El poder real de optimización bayesiana de precios es que en producción refina posterior continuamente. El resultado no es un price point estático, es input para un motor de pricing dinámico.

**Arquitectura del motor:** En cada sesión de usuario estimas segmento (predicción LTV, cohorte de retención, velocity de gasto). Según segmento, muestreas de la distribución posterior para sacar price point óptimo. Ejemplo: usuario nuevo, retención D1 %80, sin IAP previo — prior minnow domina, muestreas rango $0.99-$1.99. Mismo usuario en D7 con 2 IAP, $8 total gasto — posterior dolphin se fortaleció, pasas a rango $4.99-$6.99.

**Refinamiento posterior:** En producción, cada conversión actualiza posterior. En 30 días, el IAP de $6.99 acumula 1200 conversiones más — prior Beta(125, 4995), posterior nueva Beta(1325, 46995). El intervalo de credibilidad se estrecha: [%2.7, %2.9]. Ahora tienes %95 confianza en precio $6.99. Pero el mercado cambia — competidor lanza campaña a $4.99, conversión baja — posterior se expande de nuevo, nueva prueba se dispara.

**Integración con multi-armed bandit:** Si tu ladder IAP tiene múltiples SKU (starter pack $4.99, mega pack $19.99, ultimate $49.99), Thompson Sampling en producción es algoritmo bandit. En cada impresión muestreas posterior para cada SKU, muestras el de máximo revenue esperado. Cuando se combina con trabajo de [ASO](https://www.roibase.com.tr/es/aso), creas un motor de monetización potente — ASO empuja el tráfico al segmento correcto, pricing bayesiano le ofrece el IAP óptimo.

**Monitoreo y alertas:** Si hay cambio repentino en distribución posterior (intervalo de credibilidad se expande %50 en 3 días), eso es señal de anomalía — bug de plataforma, campaña de competidor, efecto seasonal. Construye sistema de alertas sobre varianza posterior:

```python
# Monitoreo de varianza posterior
variance_699 = trace.posterior['conv_rate_699'].var()
if variance_699 > threshold:
    trigger_alert("Price test variance spike — investigate")
```

En F2P móvil, la optimización de precios ya no es "prueba una vez, usa forever" — es un sistema que se refina continuamente con estimación posterior bayesiana, optimizado por segmento, dinámico. Si pruebas tu ladder IAP con lógica frequentist, dejas revenue whale sobre la mesa. Bayesian no solo acorta duración de prueba y da optimización por segmento — en producción crea un motor de pricing que aprende sin parar. Si tu conversion topa en %3, el problema no es precio — es quién ve qué precio, cuándo, en qué contexto. La distribución posterior te da esa respuesta.