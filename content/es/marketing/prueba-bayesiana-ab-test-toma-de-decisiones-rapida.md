---
title: "Prueba Bayesiana A/B: Toma de Decisiones Rápida"
description: "Más allá del p<0.05 frequentista: muestreo secuencial, parada temprana y cuantificación de incertidumbre. Guía para acelerar decisiones en marketing de performance."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: marketing
i18nKey: marketing-002-2026-08
tags: [prueba-bayesiana, ab-test, optimizacion-conversion, estadistica-frequentista, muestreo-secuencial]
readingTime: 8
author: Roibase
---

En marketing de performance, las pruebas A/B todavía siguen la metodología frequentista de 2010: cálculo de tamaño muestral fijo, umbral p<0.05, espera a que sea "significativo". Testeas tres creativos en Meta Ads, uno pierda claramente, pero "sin suficientes datos" quemas presupuesto dos semanas más. La prueba Bayesiana rompe este ciclo: te da derecho a parada temprana, cuantifica incertidumbre y dice "la variante B gana con probabilidad 94%". Con Google Optimize descontinuado, si construyes tu propio stack de testing, la matemática Bayesiana acelera decisiones.

## Las Reglas Fijas del Testing Frequentista

El test A/B clásico funciona así: precalcula tamaño muestral (análisis de poder: 80% poder, 5% alfa, 10% lift esperado), espera a alcanzar esa cantidad, revisa p-valor, decide. El problema: en la realidad el lift es 3%, no 10%; el tamaño muestral se extiende de 2 semanas a 8 semanas. Durante ese tiempo el creativo se fatiga, cambios estacionales afectan, el CPM sube 40%. En frecuentismo, revisar temprano está prohibido — el "peeking" infla el error tipo 1. Aunque hagas testing secuencial, las funciones de gasto alfa (Bonferroni, O'Brien-Fleming) añaden complejidad y exigen umbrales rígidos.

Escenario de e-commerce: el control tiene 2.1% CR, el flow de checkout nuevo 2.3%. Después de 1000 sesiones: 9.5% lift pero p=0.12. Frequentista dice: "no significativo, continúa". En 2000 sesiones p=0.08, aún insuficiente. En 3500 sesiones p=0.047, ahora es significativo. Pero para entonces la variante B lleva 3 semanas en vivo, la estación cambió, estimar ganancia es imposible. La matemática frequentista da veredicto binario: significativo o no. Existe un intervalo de confianza, pero se usa solo como "necesito IC 95% para decidir", nada más.

## Distribución de Probabilidad en el Enfoque Bayesiano

Bayesian plantea otra pregunta: "¿Cuál es la probabilidad de que B sea mejor que A?" La respuesta es una distribución posterior que se actualiza continuamente. Creencia previa (prior) + datos = posterior. Con cada nueva sesión, el posterior se recalcula. 100 sesiones: probabilidad de ganancia 72%, 500: 88%, 1000: 94%. Sin umbral fijo; tú decides: ¿basta 90%, o espero 95%?

Matemática: modelo beta-binomial. El prior para conversion rate es Beta(α=1, β=1) (uniforme); cada conversión suma +1 a α, cada no-conversión suma +1 a β. Posterior es Beta(α + conversiones, β + no-conversiones). Para dos variantes tienes dos distribuciones beta; con Monte Carlo extrae 10000 muestras y cuenta "B > A". Python: `scipy.stats.beta.rvs`. En BigQuery es con UDF, pero Python es más rápido para sampling.

```python
from scipy.stats import beta

# Variante A: 50 conversiones, 2000 impresiones
a_alpha, a_beta = 1 + 50, 1 + (2000 - 50)
# Variante B: 58 conversiones, 2000 impresiones
b_alpha, b_beta = 1 + 58, 1 + (2000 - 58)

samples_a = beta.rvs(a_alpha, a_beta, size=10000)
samples_b = beta.rvs(b_alpha, b_beta, size=10000)

prob_b_wins = (samples_b > samples_a).mean()
# Resultado: 0.847 → probabilidad de ganancia 84.7%
```

Este resultado va a tu dashboard diario: "B gana con probabilidad 84.7%, lift esperado 15.3%, intervalo credible 95% [2.1%, 29.8%]". No entras en el dilema "¿es significativo o no?", entregas una medida de riesgo. Si 85% de probabilidad es suficiente, detén; si no, continúa. Decisión secuencial — cada día reevaluación.

## Muestreo Secuencial y Criterio de Parada Temprana

La verdadera fortaleza Bayesiana: puedes detener el test cuando quieras. En frequentismo, el peeking prohíbe esto porque infla error tipo 1 a largo plazo; en Bayesian no existe ese concepto (actualización de creencia en lugar de frecuencias a largo plazo). El criterio de parada lo estableces tú: "Si probabilidad de ganancia >95% o <5%, detén". Con este criterio, el tamaño muestral promedio cae 30-50% (según benchmark de VWO 2024).

Pero atención: revisar muy pronto también engaña. Con 50 sesiones puede haber probabilidad de ganancia 98% por fluctuación aleatoria. Aquí entra la minimización de arrepentimiento Bayesiano: calculas expected value of information (EVOI). EVOI = (ganancia esperada) - (costo de continuar test). Si EVOI es negativo, detén. Enfoque práctico: mantén tamaño muestral mínimo (p.ej. 500 impresiones/variante), luego aplica stopping rule Bayesiana.

En [Optimización de Tasa de Conversión](https://www.roibase.com.tr/es/cro) con test de creativos Meta Ads: 3 variantes, cada una $100/día de presupuesto. Día 2: variante C pierde claramente (2.1% CTR vs. 3.8% en A/B), posterior Bayesiano dice "C pierde con 97% de probabilidad". Pausas C, redistribuyes presupuesto a A/B. Día 5: A gana con 91% de probabilidad, pausas B, todo a A. Decisión en 7 días; frequentismo esperaría 14.

## Expected Loss y Gestión de Riesgo

Probabilidad de ganancia no es todo. Variante B gana en 60% de casos pero si pierde, pierde -%8 CR; si gana, +%3 CR. Cambiar a B bajo estas condiciones es riesgoso. La métrica expected loss lo mide: la CR media de pérdida en escenarios donde A supera B. Fórmula: `E[max(0, A - B)]`. En Python: `numpy.maximum(samples_a - samples_b, 0).mean()`. Si expected loss <%1 y probabilidad de ganancia >%70, cambio seguro.

Tabla: matriz de decisión Bayesiana

| Probabilidad de ganancia | Expected loss (CR) | Acción |
|---|---|---|
| 94% | 0.3% | Cambiar ahora |
| 78% | 1.2% | Recolectar más datos |
| 51% | 2.8% | Detener, sin diferencia |

Esta tabla vive en el dashboard. No preguntas al PM "¿cambiamos a B?", dices "B gana con 78% de probabilidad pero expected loss es 1.2%, necesitamos 200 sesiones más". Decisión clara, riesgo medido, sin perder tiempo.

## Selección de Prior y Análisis de Sensibilidad

La matemática Bayesiana depende de la selección del prior. Prior uniforme (Beta(1,1)) es neutral; los datos dominan. Pero con conocimiento del dominio, prior informativo es mejor: tests anteriores muestran CR entre 2-3%, entonces Beta(20, 980) (media 2%). Este prior estabiliza el posterior en primeras 100 sesiones, reduce fluctuación aleatoria.

Testea sensibilidad del prior: corre posterior con 3 priors distintos (uniforme, débilmente informativo, altamente informativo); si probabilidad de ganancia varía >5%, los datos son insuficientes. Ejemplo: prior uniforme da 82%, informativo 77%, diferencia <%5%, adelante. Diferencia >%10% → recolecta más datos o recalibra prior (con datos históricos).

Código: sensibilidad de prior

```python
priors = [
    (1, 1),           # uniforme
    (10, 490),        # débilmente informativo, media=2%
    (30, 1470)        # altamente informativo, media=2%
]

for alpha, beta_prior in priors:
    a_posterior = beta.rvs(alpha + 50, beta_prior + 1950, size=10000)
    b_posterior = beta.rvs(alpha + 58, beta_prior + 1942, size=10000)
    prob = (b_posterior > a_posterior).mean()
    print(f"Prior Beta({alpha},{beta_prior}): P(B>A)={prob:.2f}")
```

Resultados consistentes (±3%) = prior robusto.

## Cierre: Ganancia de Velocidad y Adaptación Organizacional

El test Bayesiano A/B no basta solo; también necesitas cambiar el proceso de decisión organizacional. Pasar de "espera a que sea significativo" a "avanza con riesgo medido" requiere cambio cultural. Al CMO entregas probabilidad 90%, no certeza 100%; ese cambio psicológico cuesta. Pero la ganancia es clara: tiempo de test de 14 a 7 días en promedio, costo de variantes perdedoras -50%, velocidad de iteración creativa x2. En Meta Ads, esa velocidad se traduce directo en ROAS — más tests, creativos ganadores mejores, CPA menor. Integra matemática Bayesiana en tu dataflow (BigQuery + dbt + Looker) y eliminas cálculos manuales: actualización automática de posterior cada noche, métricas de decisión frescos cada mañana.