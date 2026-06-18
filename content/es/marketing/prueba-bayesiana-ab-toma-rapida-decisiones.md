---
title: "Test A/B Bayesiano: Toma de Decisiones Rápida"
description: "Reemplaza las reglas rígidas de tamaño muestral frequentista con enfoque Bayesiano para pruebas secuenciales. Actualiza distribuciones de probabilidad en tiempo real y detén antes."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: marketing
i18nKey: marketing-002-2026-06
tags: [ab-testing, estadistica-bayesiana, optimizacion-conversion, prueba-secuencial, performance-marketing]
readingTime: 8
author: Roibase
---

El test A/B clásico depende de un tamaño muestral fijo. Esperas a alcanzar N usuarios, ejecutas un t-test, controlas el p-value. Pero la realidad del mercado es implacable: si la variante B pierde claramente cada día, quemar tráfico durante 2 semanas más es desperdicio. El enfoque Bayesiano resuelve esto — actualiza la distribución posterior cada día y afirmas "la probabilidad de que la variante A gane es 94%". Defines el umbral de decisión, no estás atrapado en la rigidez frequentista de p<0.05.

## Las Limitaciones Estructurales del Test Frequentista

El test A/B tradicional se basa en el marco Neyman-Pearson. Defines la hipótesis nula (H₀: sin diferencia entre variantes), estableces el nivel alpha (típicamente 0.05), determinas el efecto detectable mínimo (MDE), realizas análisis de potencia (80%), y esperas hasta alcanzar el tamaño muestral resultante. Hacer un peek antes de terminar el test infla el error Tipo I — por eso el "peeking" está prohibido.

El problema: en campañas digitales, el tráfico cuesta dinero cada día. Si el cálculo de tamaño muestral dice 12.000 usuarios y recibes 800 diarios, esperas 15 días. Pero en el día 5, la tasa de conversión de la variante B cae de 2.1% a 1.3% y aún quemas 10 días más. La metodología frequentista lo justifica porque "detención temprana = sesgo". En realidad, el escenario de prueba no es estático — presupuesto limitado, estacionalidad, competencia que se mueve. Las reglas rígidas de tamaño muestral no dejan espacio para flexibilidad.

Hay otro problema: el p-value solo dice "si H₀ fuera cierta, ¿cuál es la probabilidad de ver estos datos?". No te dice la probabilidad de que la variante A sea realmente mejor. Si p=0.03, rechazas H₀, pero no puedes afirmar "A tiene 97% de probabilidad de vencer a B". El lenguaje frequentista solo te da "significancia estadística" — insuficiente para decidir en negocio.

## La Lógica del Enfoque Bayesiano

El marco Bayesiano convierte información anterior en distribución posterior. **Prior**: tu creencia sobre la tasa de conversión antes de la prueba. Conforme llegan datos, el teorema de Bayes actualiza el prior. **Posterior**: la distribución probable de la tasa de conversión según los datos acumulados.

Fórmula:  
**P(θ | data) ∝ P(data | θ) × P(θ)**

θ = tasa de conversión, data = conversiones y no-conversiones observadas. Likelihood (probabilidad de datos) × prior → posterior. La distribución Beta es el prior conjugado, así que el cálculo es simple: si la variante A muestra α conversiones y β no-conversiones, posterior = Beta(α+1, β+1).

Cada día actualizas el posterior con datos nuevos. La ventaja crítica de la prueba secuencial es esta: comparas las distribuciones posteriores y calculas "la probabilidad de que la tasa de conversión de A sea superior a la de B" mediante simulación Monte Carlo. Si supera 95%, decides. No es "alcanza N, luego mira" como en frequentista, sino "mira cada día, decide cuando cruzas el umbral".

### Ejemplo de Cálculo Posterior

```python
import numpy as np
from scipy.stats import beta

# Variante A: 120 conversiones, 1200 impresiones
alpha_A = 120 + 1  # +1 para prior uniforme
beta_A = (1200 - 120) + 1

# Variante B: 95 conversiones, 1150 impresiones
alpha_B = 95 + 1
beta_B = (1150 - 95) + 1

# Monte Carlo: extrae 10,000 muestras
samples_A = beta.rvs(alpha_A, beta_A, size=10000)
samples_B = beta.rvs(alpha_B, beta_B, size=10000)

# Probabilidad de que A > B
prob_A_wins = (samples_A > samples_B).mean()
print(f"P(A > B) = {prob_A_wins:.3f}")
```

Salida de ejemplo: `P(A > B) = 0.983` — A gana con 98.3% de confianza. El t-test frequentista con los mismos datos podría dar p=0.06 (no significativo), pero Bayesiano dice 98%. ¿Cuál es más relevante para decidir en negocio?

## Pruebas Secuenciales y Detención Temprana

El test Bayesiano está diseñado para ser secuencial. Actualiza el posterior cada día, verifica el umbral de decisión. Cuando "Probability to be best" supera 95%, detén la prueba e implementa el ganador. Esta detención temprana no infla el error Tipo I como en frequentista, porque el criterio de decisión es probabilidad posterior — no p-value.

Implementación práctica:  
1. Define el prior (típicamente Beta(1,1) uniforme)  
2. Acumula datos de conversión diarios  
3. Calcula el posterior  
4. Calcula P(A > B) y P(B > A)  
5. Si cualquiera supera 95%, detén la prueba  
6. Si después de 14 días no alcanzas 95%, finaliza como "no concluyente" (datos insuficientes)

Este enfoque es crítico en procesos de [optimización de tasa de conversión](https://www.roibase.com.tr/es/cro). En una prueba de landing page donde la variante B muestra 30% menor CTR en CTA durante los primeros 3 días, el posterior Bayesiano dice "96% B es peor". La regla frequentist de tamaño muestral te obligaría a esperar 10 días más, pero tú detienes en el día 3, redirige tráfico a A. Menor costo de oportunidad.

### Dinámicas de Tamaño Muestral

Bayesiano no requiere tamaño muestral fijo, pero puedes estimar el "tamaño muestral esperado". Depende de cuán informativo sea el prior. Si la tasa de conversión histórica es 10%, informas el prior con Beta(10,90) y necesitas menos datos. Con prior no-informativo tardará más, pero aún más rápido que frequentist.

Tabla de simulación (ejemplo):

| Verdadero Δ | N Frequentista | Expected N Bayesiano | N Bayesiano percentil 90 |
|---|---|---|---|
| +10% | 4,800 | 3,200 | 5,100 |
| +20% | 1,200 | 800 | 1,400 |
| +5% | 19,200 | 14,000 | 22,000 |

En lifts pequeños, Bayesiano también tarda pero no es tan rígido. En lifts grandes, 30-40% más rápido.

## Contraargumentos y Tradeoffs

**1. La elección del prior es subjetiva:** Cierto, introduces creencia previa. Pero con prior no-informativo (Beta(1,1)) minimizas este sesgo. Con suficientes datos, el likelihood domina y el prior se diluye. Frequentista parece "objetivo" pero las elecciones de alpha, power y MDE también son subjetivas.

**2. Costo computacional:** Test Bayesiano requiere actualización posterior diaria + muestreo Monte Carlo. T-test frequentista es cálculo único. Pero las herramientas modernas (pymc, Stan, Google Optimize Bayesiano) lo automatizan. Extraer 10.000 muestras toma milisegundos — no es obstáculo.

**3. Conformidad regulatoria:** En ensayos farmacéuticos con aprobación FDA, frequentist es estándar. En marketing digital, no hay restricción. Plataformas como Optimizely, VWO y AB Tasty ofrecen opciones Bayesianas.

**4. Confusión con multi-armed bandits:** Prueba Bayesiana y algoritmos bandit (Thompson sampling) se confunden. Los bandits optimizan exploración-explotación, asignando más tráfico a variantes ganadoras durante la prueba. El test Bayesiano usa split fijo y usa posterior para decidir. Son casos de uso diferentes — bandit para campañas de alta velocidad, Bayesiano para cambios de producto de ciclo largo.

## Escenario Real: Prueba de Creative en Meta Ads

Pruebas 3 variantes de creative en Meta Ads (A, B, C). Presupuesto diario $500, CPA objetivo $25. Frequentist requiere 1,000 conversiones por creative (poder 80%, MDE 15%). Con 60 conversiones diarias, esperas 50 días. Pero en el día 10, el CPA de C sube a $40 — obviamente malo.

Con Bayesiano:  
- Acumula diario: spend, conversiones por creative  
- Calcula distribución posterior de CPA (usa likelihood Gamma, CPA es positivo continuo)  
- Calcula P(CPA_C > $30) = 92%  
- Pausa C en el día 10, redistribuye presupuesto a A y B  

En el día 20, P(CPA_A < CPA_B) = 96%. Declares A ganador. Decidiste en 20 días en lugar de 30. Ahorras $5,000 + 10 días ejecutando CPA mejor.

Este tipo de decisión dinámica es crítica post-iOS14. La pérdida de señal debilitó la confiabilidad de pruebas — el posterior Bayesiano muestra incertidumbre explícitamente. "Los datos son insuficientes, la distribución es muy ancha" — el p-value frequentista no comunica esto.

---

La prueba A/B Bayesiana resuelve los problemas de rigidez de tamaño muestral y restricción de "peeking" del enfoque frequentista. Con testing secuencial, mides poder de decisión diario y detiene cuando alcanzan confianza suficiente — antes. La elección del prior introduce subjetividad pero prior no-informativo + abundancia de datos lo mitigua. En performance marketing, si necesitas flexibilidad de campaña, eficiencia presupuestaria y velocidad de decisión, el marco Bayesiano es correcto. Construye tu infraestructura de prueba alrededor de actualización posterior dinámica, no cálculo estático de N.