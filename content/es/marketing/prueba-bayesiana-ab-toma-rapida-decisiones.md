---
title: "Prueba Bayesiana A/B: Tomar Decisiones Rápidas"
description: "Aprende a abandonar los rígidos requisitos de tamaño de muestra del testing frecuentista y acelera tus procesos de prueba con enfoque Bayesiano secuencial."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: marketing
i18nKey: marketing-002-2026-07
tags: [ab-testing, bayesian-statistics, conversion-optimization, sequential-testing, data-driven-marketing]
readingTime: 8
author: Roibase
---

La metodología clásica de prueba A/B se basa en un tamaño de muestra fijo: esperas a alcanzar un número predeterminado de visitantes, luego calculas la significancia estadística y finalmente tomas una decisión. Este enfoque funcionó en 2010 porque el tráfico era costoso y las pruebas podían durar meses. En 2026, el marketing de performance opera en ciclos semanales, el refresh de creative ocurre cada 14 días, la estrategia de campaña cambia mensualmente. Probar una variante de landing page durante 6 semanas ya no es una opción — es una pérdida. El testing Bayesiano resuelve este problema mediante un mecanismo de decisión secuencial: cada día se actualiza la distribución posterior, cuando alcanzas el umbral de confianza detienes la prueba y lanzas el ganador.

## La Trampa del Tamaño de Muestra Frecuentista

La prueba A/B frecuentista clásica se basa en p-value < 0.05. Para alcanzar este umbral, primero realizas un análisis de poder: si tienes una conversión baseline de %5, esperas un lift relativo de %10 y buscas %80 de poder estadístico, necesitas mínimo 3.100 usuarios por variante. Si recibes 500 visitantes únicos diarios, la prueba dura 12 días. El problema: en el día 5, la variante B claramente gana pero carece de significancia estadística — debes esperar. El día 12 llega la significancia pero tu competidor ya lanzó una landing page alternativa, el mensaje se volvió obsoleto. El testing frecuentista tiene dos daños: si decides temprano incurres en Type I error (falso positivo), si esperas demasiado sufres opportunity cost.

El testing secuencial existe en el framework frecuentista (corrección Bonferroni, funciones de gasto alpha) pero es complejo. Debes reservar presupuesto alpha para cada análisis intermedio — si quieres detener temprano, el valor crítico se enduerce. Resultado: la prueba se alarga o la confianza disminuye.

El enfoque Bayesiano te libera de este dilema porque cada observación es información nueva — la posterior anterior se convierte en la prior actual. El tamaño de muestra no es fijo, es secuencial. Cada día la distribución posterior se actualiza, cuando "la probabilidad de que B sea mejor que A supera %95" detienes y lanzas. No es penalización por detención temprana — es una característica.

## Distribución Posterior y Actualización Secuencial

En testing Bayesiano comienzas con una distribución prior: tu creencia anterior sobre la tasa de conversión. Si pruebas una landing page de e-commerce con baseline %3 de conversión y desviación estándar %0.5 (basado en datos históricos), esto se convierte en un prior Beta(30, 970). En los primeros 100 visitantes ves 4 conversiones en la variante B. La posterior se actualiza así:

```
Prior: Beta(α=30, β=970)
Verosimilitud: 4 éxitos, 96 fracasos
Posterior: Beta(α=30+4, β=970+96) = Beta(34, 1066)
```

Media posterior = 34/(34+1066) = 0.0309 (%3.09). Al día siguiente llegan 200 visitantes más con 7 conversiones. La posterior de ayer se convierte en la prior de hoy:

```
Prior: Beta(34, 1066)
Verosimilitud: 7 éxitos, 193 fracasos
Posterior: Beta(41, 1259)
```

Media posterior = 0.0316 (%3.16). Mientras tanto, la variante A en el mismo período: 500 visitantes, 14 conversiones. Posterior A = Beta(44, 1456), media = 0.0293. En este punto comparas ambas distribuciones posteriores: calculas P(B > A) mediante simulación Monte Carlo — extraes 10.000 muestras y cuentas cuántas veces B es mayor. Si el resultado es %73, aún no tienes suficiente certeza. El día 5, P(B > A) = %96, alcanzas tu umbral de decisión (%95) y detienes la prueba.

En testing frecuentista esto es imposible. Cada observación intermedia introduce riesgo de inflación alpha, creas un problema de comparaciones múltiples. En Bayesiano, la posterior se actualiza cada día pero el criterio de decisión permanece fijo: el nivel de confianza. La detención temprana no introduce sesgo porque la inferencia Bayesiana está condicionada a la verosimilitud — no hay obligación de fijar el tamaño de muestra.

## Aplicación Práctica: Regla de Detención y Selección de Umbral

El testing Bayesiano A/B es fácil de configurar pero requiere disciplina en la regla de detención. Debes definir tres umbrales:

**1. Tamaño de muestra mínimo (red de seguridad):** Previene decisiones demasiado tempranas. Nunca decidas antes de ver 100 usuarios por variante — la varianza posterior es demasiado amplia, riesgo de falso positivo. El whitepaper de Google Optimize 2019 recomendaba mínimo 250 conversiones; en práctica 50-100 conversiones son suficientes (depende de la fuerza del prior).

**2. Umbral de confianza:** P(B > A) > 0.95 es la elección clásica. Si buscas decisiones más agresivas usa 0.90, para tests conservadores 0.97. Si el impacto financiero es alto (cambio en checkout) usa 0.99.

**3. Significancia práctica (lift threshold):** Una diferencia estadística de %0.5 de lift relativo puede ser significativa pero sin impacto en el negocio. Establece un filtro práctico como lift > %5. No solo calcules P(B > A), sino P(B > A * 1.05).

**Ejemplo de código (Python + PyMC):**

```python
import pymc as pm
import numpy as np

# Prior: Beta(30, 970) — baseline %3
with pm.Model() as model:
    p_A = pm.Beta("p_A", alpha=30, beta=970)
    p_B = pm.Beta("p_B", alpha=30, beta=970)
    
    # Datos observados
    obs_A = pm.Binomial("obs_A", n=500, p=p_A, observed=14)
    obs_B = pm.Binomial("obs_B", n=500, p=p_B, observed=18)
    
    trace = pm.sample(5000, return_inferencedata=True)

# Comparación posterior
p_B_samples = trace.posterior["p_B"].values.flatten()
p_A_samples = trace.posterior["p_A"].values.flatten()
prob_B_better = np.mean(p_B_samples > p_A_samples)
prob_lift_5pct = np.mean(p_B_samples > p_A_samples * 1.05)

print(f"P(B > A) = {prob_B_better:.2%}")
print(f"P(B > A*1.05) = {prob_lift_5pct:.2%}")
```

Este código se ejecuta cada día. Cuando prob_B_better > 0.95 y prob_lift_5pct > 0.80, detienes la prueba. Si estas condiciones se cumplen el día 5, mientras el enfoque frecuentista espera 12 días, tú ganas 7 días.

## Tradeoff: Selección de Prior y Sensibilidad

El punto criticado del testing Bayesiano: la selección del prior es subjetiva. Si usas un prior débil (Beta(1, 1) — uniforme), la posterior depende completamente de los datos pero la convergencia es lenta. Si usas un prior fuerte (Beta(300, 9700)), la información anterior domina la posterior — el impacto de nuevos datos disminuye. Necesitas equilibrio.

**Estrategia de selección de prior:**

| Escenario | Prior | Razón |
|-----------|-------|-------|
| Producto nuevo, sin datos | Beta(1, 1) | Uniforme, deja que los datos hablen |
| Página similar existe | Beta(α=30, β=970) | Información histórica de %3 conversión |
| Lanzamiento agresivo | Beta(3, 97) | Prior débil, convergencia rápida |
| Checkout crítico | Beta(300, 9700) | Prior fuerte, actualización conservadora |

Para evaluar el impacto del prior, realiza análisis de sensibilidad: ejecuta los mismos datos con Beta(1,1), Beta(10,990) y Beta(30,970). Si las posteriores difieren más de %5, el prior es dominante — usa un prior más débil o recopila más datos.

El otro tradeoff: el testing Bayesiano no es tan "listo para publicación" como el frecuentista. Si escribes un paper académico necesitas p-value; si presentas a C-suite un gráfico posterior es suficiente. En procesos de [Optimización de Tasa de Conversión](https://www.roibase.com.tr/es/cro), la velocidad es crítica — en ciclos de sprint semanal, el testing Bayesiano secuencial es %40 más rápido que frecuentista (según benchmark VWO 2023: mediana 8 días vs 5 días).

## Impacto Empresarial de la Velocidad de Prueba

El verdadero ganancia del testing Bayesiano secuencial es la velocity. En marketing de performance, la fatiga creativa ocurre en 10-14 días, el ciclo de campaña es 30 días. Si cierras la prueba landing page en 12 días haces 2 iteraciones por mes. Con Bayesiano en 5 días haces 6 iteraciones. Asumiendo %5 lift por iteración, el impacto compuesto anualmente: frecuentista %12, Bayesiano %34 (1.05^12 vs 1.05^6).

El testing secuencial amplifica ganancias en pruebas multivariantes (A/B/C/D). En frecuentista, la corrección Bonferroni para comparaciones múltiples aumenta el tamaño de muestra 3-4 veces. En Bayesiano, cada variante tiene su posterior separada, las comparaciones pareadas ocurren sin gasto alpha. Frecuentista requiere 15 días para 4 variantes; Bayesiano lo hace en 6 días.

Último punto: la detención temprana no es solo para pruebas ganadoras. Si la variante B muestra %20 de caída en conversión, el día 3 tienes P(A > B) = %99 — detienes la prueba, salvas el tráfico perdido. Con frecuentista esperarías 12 días, enviando tráfico a la página de bajo rendimiento 9 días innecesariamente. El testing Bayesiano secuencial proporciona protección de downside.

El testing Bayesiano secuencial A/B ya no es un lujo — es necesario. Tras la deprecación de cookies, la atribución es difícil, los ciclos de campaña son cortos, los refreshes creativos son rápidos. Las pruebas frecuentista clásicas no mantienen este ritmo. Con la actualización posterior Bayesiana, cada día reúnes información nueva; cuando alcanzas el umbral de confianza, tomas la decisión. La detención temprana no introduce sesgo — es una característica. Con disciplina en la selección del prior, claridad en la regla de detención y un filtro de significancia práctica, el testing Bayesiano es tanto rápido como confiable.