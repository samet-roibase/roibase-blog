---
title: "Optimización Bayesiana de Precios en F2P Mobile"
description: "Reemplaza A/B tests frecuentistas con enfoque Bayesiano para IAP: estimación posterior, price ladders por segmento y revenue lift medible en F2P mobile."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: gaming
i18nKey: gaming-002-2026-07
tags: [bayesian-optimization, iap-pricing, f2p-monetization, mobile-gaming, retention-engineering]
readingTime: 8
author: Roibase
---

En juegos mobile F2P, las decisiones de precio de IAP suelen tomarse con una mezcla de intuición y análisis competitivo. En 2026, este enfoque ya no es suficiente. El tráfico que llega con Apple Search Ads está segmentado: keywords de alto intent, lookalike, broad. Cada segmento tiene un perfil de WTP (disposición a pagar) diferente. Los A/B tests frecuentistas se quedan cortos aquí — requieren esperar 4 semanas y 10.000+ conversiones para alcanzar 95% de confianza. La optimización bayesiana de precios permite decidir con apenas 1.000 conversiones usando distribuciones posteriores.

## Dónde Se Atasca el A/B Test Frecuentista en IAP

Los tests A/B clásicos funcionan así: spliteas el paquete de $4.99 vs $6.99 al 50/50, esperas 4 semanas y aplicas chi-square para obtener el p-value. El problema: la cohorte mobile cambia rápidamente. Con un churn del 68% en D7, los usuarios restantes en la semana 4 no reflejan el perfil de la semana 1. Además, se pierde la información de segmento — el usuario de Apple Search Ads y el orgánico se prueban en el mismo bucket.

El segundo problema del enfoque frecuentista es la regla de parada: si decides temprano, cometes error de "peeking"; si esperas demasiado, cambios de meta (nuevos creativos, ASO) invalidan el test. En mobile, este ritmo es insostenible.

El tercer problema: la asunción de resultado binario. El test frecuentista responde "¿qué precio gana?" pero no "¿qué segmento prefiere qué precio?". Sin distribución posterior por segmento, no puedes construir una escalera de precios.

## Framework Bayesiano: Prior, Likelihood, Posterior

El enfoque Bayesiano se fundamenta en esta fórmula:

```
P(θ | data) ∝ P(data | θ) × P(θ)
```

- **P(θ):** Prior — distribución WTP de datos previos de juegos/categoría
- **P(data | θ):** Likelihood — conversiones de IAP observadas
- **P(θ | data):** Posterior — prior actualizada por los datos nuevos

Para un test de precio IAP, sea θ = {$4.99, $6.99, $9.99}. Define una distribución prior Beta(α, β) para cada precio. Por ejemplo, para $4.99 con α=20, β=80 (conversión esperada 20%). Cuando lleguen las primeras 500 impresiones, suma las conversiones de cada precio al prior Beta:

```python
# $4.99: 500 impresiones, 110 conversiones
alpha_post = 20 + 110
beta_post = 80 + (500 - 110)
# Posterior: Beta(130, 470)
```

Desde esta posterior, realiza muestreo Monte Carlo para calcular revenue esperado:

```python
samples = np.random.beta(130, 470, size=10000)
revenue_4_99 = samples * 4.99
mean_revenue = revenue_4_99.mean()
```

La ventaja Bayesiana: puedes decidir con 500 conversiones — si el intervalo de confianza se estrecha, detén el test; si sigue amplio, continúa. La regla de parada es flexible, sin error de peeking.

## Price Ladders por Segmento

En F2P mobile, ofrecer un único precio a todos es subóptimo. El tráfico que llega con [App Store Optimization](https://www.roibase.com.tr/es/aso) contiene intents diferentes: keywords branded generan 8% CVR mientras que keywords genéricas solo 1.2%. Puedes mantener distribuciones posteriores separadas para cada segmento.

Ejemplo de segmentación:

| Segmento | Prior (α, β) | Conv. Observadas | Posterior (α', β') | WTP Medio |
|---|---|---|---|---|
| Branded KW | (30, 70) | 48/200 | (78, 222) | $7.20 |
| Generic KW | (12, 88) | 18/300 | (30, 370) | $4.50 |
| Orgánico | (20, 80) | 35/250 | (55, 295) | $5.80 |

Usando estas posteriores, construye la escalera de precios:

- Segmento Branded → ofrece paquete "premium" a $9.99
- Segmento Generic → ofrece paquete "starter" a $4.99
- Segmento Orgánico → ofrece paquete "standard" a $6.99

La presentación de precio por segmento se implementa con feature flags server-side. El SDK de Unity IAP envía la información de segmento al backend, que devuelve el precio según la distribución posterior. Esta arquitectura es más dinámica que A/B test — la posterior se actualiza semanalmente y la escalera de precios se auto-optimiza.

### Thompson Sampling para Asignación en Tiempo Real

El framework Bayesiano no es estático — con Thompson Sampling logras equilibrio exploration/exploitation. En cada impresión de IAP:

1. Extrae 1 sample de la posterior de cada precio
2. Presenta al usuario el precio con mayor revenue esperado
3. Suma el resultado de conversión a la posterior

Este método minimiza "regret" — el costo de impresiones no servidas al precio óptimo. Tras 10.000 impresiones, Thompson Sampling genera 12-18% más revenue lift comparado con métodos clásicos (benchmark: resultados de King en Candy Crush Saga 2025).

## Consideraciones en Estimación Posterior

La parte sensible del enfoque Bayesiano es la elección del prior. Un prior muy débil (α=1, β=1 uniforme) mantiene la posterior inestable en las primeras 100 conversiones. Un prior muy fuerte (α=100, β=400) hace que la posterior sea lenta en actualizarse con datos nuevos.

La fuente correcta del prior: datos de cohort del juego anterior o de juegos similares del primer mes. Si no hay datos previos, usa benchmarks de industria pero mantén un prior débil (α=5, β=20).

Segundo punto: cantidad de segmentos. Con 10 segmentos debes actualizar posteriores separadas para cada uno — esto adelgaza los datos, ampliando los intervalos de confianza. Mantén entre 3-5 segmentos. Para más granularidad, usa Modelo Bayesiano Jerárquico (HBM) — prior a nivel de categoría en el nivel superior, posterior a nivel de segmento en el inferior.

Tercer punto: selección de métrica revenue. IAP conversion es binaria pero revenue es continua. La distribución Beta es correcta para conversión pero para modelar revenue necesitas Gamma o Log-Normal. Al estimar revenue posterior:

```python
# Gamma(shape=α, rate=β): revenue medio
mean_revenue = (alpha_post / beta_post) * price
```

## Impacto en Churn y LTV

La optimización Bayesiana de precios no solo optimiza la primera conversión IAP — la precisión de precio por segmento también afecta churn. Segmentos sobreprecificados experimentan 22% más churn (D30 retention -%8). Segmentos subprecificados mantienen LTV bajo — si el usuario se acostumbra a $4.99, resiste cambios a paquetes de $9.99.

Una escalera de precios correcta reduce churn porque cada segmento ve un precio alineado a su valor percibido. Este efecto se mide con análisis de cohorte:

- Cohorte con price ladder Bayesiano: D30 retention 38%, ARPU $12.50
- Cohorte con precio estático: D30 retention 34%, ARPU $11.20

Revenue lift: $12.50 - $11.20 = $1.30 por usuario. Con 100.000 MAU, esto genera $130.000/mes en diferencia.

## Implementación Operacional

Para llevar optimización Bayesiana de precios a producción necesitas este stack:

- **Event tracking:** impresión IAP + conversión (Adjust/AppsFlyer)
- **Motor Bayesiano:** Python + PyMC3 o Stan (actualización posterior cada 24 horas)
- **Feature flag:** LaunchDarkly o backend custom (mapeo segmento → precio)
- **Monitoreo:** dashboard de convergencia posterior (Looker/Metabase)

Las primeras 2 semanas opéralo en shadow mode — el motor Bayesiano propone precios pero producción mantiene precios estáticos. Cuando la posterior se estabilice (intervalo de confianza < 10%), pásamelo a producción.

Importante: el modelo Bayesiano se actualiza continuamente pero los cambios de precio no son diarios. Establece ciclo de revisión semanal — si hay shift >15% en la posterior, ajusta el precio; si no, espera. Presentar precios inconsistentes al usuario genera pérdida de confianza.

---

La optimización Bayesiana de precios en F2P mobile ya no es experimental — King, Supercell, Playrix la usan en producción. Aunque el framework parezca complejo inicialmente, la actualización posterior es un proceso mecánico. Con prior correcto + estrategia de segmentación, en 6-8 semanas conseguirás 10-15% de revenue lift. Volver a fijación estática de precios es subóptimo en 2026.