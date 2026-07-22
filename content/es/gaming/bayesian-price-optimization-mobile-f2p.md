---
title: "Optimización de Precios con Bayesian en Mobile F2P"
description: "Optimiza price ladder tests con estimación posterior y modelado basado en segmentos. Estrategia de fijación de precios basada en datos."
publishedAt: 2026-07-22
modifiedAt: 2026-07-22
category: gaming
i18nKey: gaming-002-2026-07
tags: [f2p-monetization, bayesian-optimization, iap-pricing, mobile-gaming, data-driven-pricing]
readingTime: 8
author: Roibase
---

En juegos mobile F2P, las decisiones de fijación de precios generalmente se basan en conjeturas o referencias de "precios comunes en el mercado". Pack starter de $0.99, mid-tier de $4.99, whale bundle de $99.99 — esta price ladder es fija en la mayoría de juegos. Sin embargo, la estructura de cohortes, mix geográfico y percepción de valor de cada juego es diferente. La optimización de precios Bayesian te permite modelar estas diferencias a través de distribuciones de probabilidad posterior, encontrando el punto de precio óptimo en cada segmento. Implementar un sistema que aprende continuamente en lugar de A/B tests clásicos puede mejorar tu IAP conversion rate entre 15-40%.

## Por qué el enfoque Bayesian es mejor que A/B testing

El A/B test clásico funciona sobre hipótesis fijas: compara dos precios como $4.99 vs $5.99, espera hasta alcanzar 95% de confianza y elige el ganador. Este enfoque tiene dos problemas: primero, durante el test el tráfico se divide por la mitad y la variante con peor desempeño sigue sirviendo a usuarios (opportunity cost). Segundo, cuando termina el test solo obtienes una decisión "A o B" — no aprendes sobre valores intermedios o diferencias específicas por segmento.

La optimización Bayesian comienza con una prior distribution (por ejemplo, "el precio probablemente está distribuido uniformemente entre $3-$7"), agrega cada dato de conversión a la posterior y actualiza continuamente la distribución de probabilidad. Esto permite que algoritmos como Thompson Sampling dirijan dinámicamente el tráfico hacia la variante ganadora — durante el test se maximiza el revenue total. Por ejemplo, en un test de 10 días, el enfoque Bayesian genera 8-12% más revenue porque solo se envía tráfico mínimo a puntos de precio ineficientes.

Además, el modelo Bayesian no solo te dice "este precio ganó", sino que proporciona intervals de confianza como "este precio tiene 87% de probabilidad de ser óptimo". Esta información acelera la iteración: puedes llevar un precio a producción incluso con 60% de confianza y comenzar un nuevo test, porque la distribución posterior ya contiene suficiente información.

## Configuración de prior basada en segmentos en IAP price ladder testing

En juegos F2P, no todos los usuarios tienen el mismo valor. Identificar correctamente tus segmentos de spenders fortalece el prior del modelo Bayesian. Segmentación típica: **minnows** (lifetime spend <$10), **dolphins** ($10-$100), **whales** (>$100). Cada segmento tiene elasticidad de precio diferente — los minnows convierten incluso en packs de $0.99, mientras que los whales compran bundles de $99.99 sin fijarse en el precio.

Para construir distribution priors por segmento necesitas datos históricos. Por ejemplo, si tu segmento minnow tiene un conversion rate promedio de 3.2% entre $0.99 y $1.99 en IAPs, usa como prior mean $1.49 y sigma $0.50 (asumiendo distribución normal). En el segmento whale, si el conversion rate permanece plano entre $49.99-$149.99, un prior uniforme es más apropiado — reflejando la hipótesis de que "los whales son insensibles al precio".

La ventaja del prior por segmento es que previene el aprendizaje cruzado. El A/B test clásico mezcla todos los usuarios en un único pool y el alto conversion de whales en una variante de precio bajo puede enmascarar el precio óptimo para minnows. El modelo Bayesian actualiza la posterior por separado en cada segmento, produciendo precios segment-óptimos como $1.49 para minnows y $79.99 para whales.

### Ajuste de prior específico por geografía

La paridad de poder de compra varía dramáticamente entre Tier-1 (US, UK, JP) y mercados emergentes (BR, TR, IN). En US, un pack de $4.99 se percibe como "barato", mientras que el mismo precio en TR (alrededor de ₺150) es segmento medio-alto. Normalizar la distribución prior por geografía requiere usar data de ARPU local. Por ejemplo, si el ARPU diario promedio en US es $0.42 y en TR es $0.18, scale el prior mean por esa ratio (0.18/0.42 = 43%). De esta forma, el modelo prueba la misma price ladder relativa en cada geografía, embebiendo la diferencia de valor absoluto dentro del prior.

## Estimación posterior e implementación de Thompson Sampling

El motor de runtime del modelo Bayesian es la estimación posterior. En cada impresión de IAP (muestra de oferta), extraes un sample de la distribución posterior actual (por ejemplo, si es Beta, usa `np.random.beta(alpha, beta)`). Muestras el precio correspondiente al usuario. Si compra, alpha += 1; si pasa, beta += 1 — la posterior se actualiza.

Thompson Sampling utiliza este mecanismo para distribuir tráfico. Extrae una expectativa de recompensa desde la posterior de cada variante y selecciona la que tenga mayor recompensa. Los primeros días todas las variantes reciben tráfico igual (exploración), luego el tráfico migra hacia la variante ganadora (explotación). El balance se logra mediante la varianza posterior, no mediante epsilon — es decir, variantes con varianza baja (alta confianza) acumulan más tráfico.

Para implementación práctica, puedes usar `scipy.stats.beta` o `pymc3` de Python. Un bloque de código simple:

```python
import numpy as np
from scipy.stats import beta

# Prior: alpha=1, beta=1 (uniforme)
alpha_a, beta_a = 1, 1  # Variante A ($4.99)
alpha_b, beta_b = 1, 1  # Variante B ($5.99)

def select_variant():
    sample_a = np.random.beta(alpha_a, beta_a)
    sample_b = np.random.beta(alpha_b, beta_b)
    return "A" if sample_a > sample_b else "B"

def update_posterior(variant, converted):
    global alpha_a, beta_a, alpha_b, beta_b
    if variant == "A":
        if converted:
            alpha_a += 1
        else:
            beta_a += 1
    else:
        if converted:
            alpha_b += 1
        else:
            beta_b += 1
```

Este loop simple converge a %2 de error en la media posterior respecto al conversion rate real después de 10.000 impresiones (si la prior Beta es correcta). En producción, puedes actualizar parámetros posteriores cada día con BigQuery + Airflow e iniciar nuevas cohortes con la distribución actualizada.

## Multi-armed bandit vs modelo Bayesian completo

En la literatura de optimización de precios Bayesian, hay dos enfoques principales: **multi-armed bandit** (MAB) y **regresión Bayesian completa**. El enfoque MAB es el Thompson Sampling que describimos — define variantes de precio discretas (por ejemplo, 5 puntos de precio) como arms, manteniendo posterior separada para cada uno. Ventaja: implementación simple, runtime ligero, decisiones en tiempo real.

La regresión Bayesian completa modela el precio como variable continua, ligando la probabilidad de conversión al precio mediante regresión logística o Gaussian process. Este enfoque es más flexible — por ejemplo, puede aprender que "conforme el precio sube, el conversion rate cae exponencialmente". Desventaja: requiere training del modelo con BigQuery + stack de Python, no puedes tomar decisiones en tiempo real (predicción batch).

En juegos F2P, MAB generalmente es suficiente porque la price ladder ya es discreta ($0.99, $2.99, $4.99, $9.99, etc.). El modelo Bayesian completo entra en juego cuando quieres dynamic pricing (precio diferente para cada usuario) — pero esto es prohibido por muchas app store policies (price discrimination). Un punto medio: MAB por segmento, más regresión Bayesian completa dentro de cada segmento. Así puedes encontrar continuamente el punto óptimo entre $79.99-$149.99 para el segmento whale.

## Uplift de revenue e impacto en LTV de cohorte

El verdadero ROI de la optimización de precios Bayesian se ve en la LTV de cohorte. En la primera semana del test, el conversion rate sube 8%, pero la LTV a D30 de estos usuarios es 15-20% más alta. ¿Por qué? Porque el punto de precio óptimo se ajusta perfectamente a la percepción de valor del usuario — ni muy bajo (caída de valor percibido) ni muy alto (fricción). Estos usuarios tienen mayor probabilidad de comprar el segundo pack después del primer IAP.

Un ejemplo: en un RPG mid-core, el modelo Bayesian sugirió $3.49 en lugar de $4.99 para el starter pack (segmento minnow, US). El conversion rate de la primera semana subió de 22% a 28% (+27% relativo). La retención D7 se mantuvo igual (42%), pero el ARPU a D30 subió de $2.18 a $2.51 (+15%). ¿Por qué? El precio de $3.49 redujo el umbral de "puedo invertir en este juego", disminuyendo la fricción de segunda compra. La LTV total de la cohorte creció de $8.90 a $10.20 (+15%).

Para medir este efecto, el análisis de cohortes es obligatorio. En BigQuery, rastrea columnas como `user_id`, `install_date`, `first_iap_price`, `d7_revenue`, `d30_revenue`. Flag la variante de test Bayesian con `experiment_group` y compara las curvas LTV contra el grupo de control. El test de significancia es prematuro en los primeros 7 días; la confianza aumenta en D30.

## Concepciones erróneas y trade-offs

El malentendido de que la optimización de precios Bayesian "gana inmediatamente" es común. En realidad, la convergencia posterior requiere mínimo 5.000-10.000 impresiones (por segmento). En juegos con poco tráfico (DAU <50k), el test se extiende 4-6 semanas. Durante este tiempo, el data pipeline (logging de impresiones, tracking de conversiones, actualización posterior) debe funcionar sin fallas — un solo bug corrompe toda la posterior.

El segundo trade-off es la granularidad de segmento. Si defines segmentos muy finos (por ejemplo, "L5-10, US, Android, whale"), el tamaño de muestra en cada segmento es insuficiente y la posterior permanece con alta varianza. Regla práctica: cada segmento debe recibir mínimo 200 IAPs por día. Si queda por debajo, consolida segmentos (por ejemplo, US+UK+CA se convierte en un único segmento "Tier-1 EN").

El tercer punto es el impacto psicológico del cambio en price ladder. Si el usuario vio $4.99 ayer pero hoy ve $3.99, se crea percepción de "descuento" e impacta en el conversion — pero no es sostenible. Durante el test Bayesian, mantén el rango de precio estrecho (máximo ±20%), no hagas cambios radicales (ejemplo, $4.99 → $1.99).

## Scale post-test y automatización

La optimización de precios Bayesian no es un test único, sino un sistema de aprendizaje continuo. Cuando termina el test, llevas el precio ganador a producción, pero conservas la distribución posterior para usarla como prior en nuevas cohortes. Por ejemplo, en temporada de holiday Q4 el ARPU sube 30% — la posterior del quarter anterior inicia como warm prior, el modelo converge rápidamente al nuevo óptimo en lugar de hacer cold start.

Puedes automatizar con Airflow + BigQuery + Firebase Remote Config. Cada día, un DAG de Airflow lee los parámetros posterior de BigQuery, escribe nuevas variantes de precio en Firebase Remote Config. El SDK cliente fetch Remote Config y muestra la oferta de IAP. El evento de conversión se loguea en BigQuery, se actualiza la posterior — el loop se cierra. La configuración inicial toma 2-3 semanas, después funciona sin intervención.

El paso final: si quieres scale el modelo Bayesian a múltiples juegos, construye un "pricing service" centralizado. Cada juego envía metadata (género, mix geográfico, ARPU), el servicio sugiere prior distribution según el perfil del juego. Así, juegos nuevos no sufren cold start sino que hacen transfer learning desde la posterior de juegos similares. El servicio de [Optimización de App Store](https://www.roibase.com.tr/es/aso) de Roibase integra este tipo de pipeline de aprendizaje cross-app con A/B tests creativos en ASO — el mismo framework Bayesian se puede aplicar a variantes de product page.

---

La optimización de precios Bayesian es uno de los pilares fundamentales del revenue engineering en juegos F2P. Con prior de segmento correcto, actualización de posterior continua y Thompson Sampling, puedes aumentar tu IAP conversion entre 15-40% y elevar visiblemente la LTV de cohorte. Implementar un sistema que aprende en lugar de A/B tests clásicos crea un efecto compounding a largo plazo — cada nueva cohorte comienza más optimizada que la anterior. Para comenzar, divide tu price ladder actual en 3-5 variantes, construye prior desde conversion rates históricos y observa la posterior durante las primeras 10.000 impresiones.