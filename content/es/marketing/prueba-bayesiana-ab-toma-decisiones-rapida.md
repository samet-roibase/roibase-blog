---
title: "Prueba A/B Bayesiana para Tomar Decisiones Rápidas"
description: "Supera la pérdida de tiempo de las pruebas frecuentistas con el enfoque Bayesiano. Acelera tus pruebas A/B 3x con testing secuencial, probabilidad posterior y tamaño de muestra dinámico."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: marketing
i18nKey: marketing-002-2026-07
tags: [pruebas-ab, estadistica-bayesiana, optimizacion-conversion, inferencia-estadistica, ingenieria-crecimiento]
readingTime: 7
author: Roibase
---

Si quieres ganar velocidad en el marketing de rendimiento, es posible que estés ejecutando tus pruebas A/B con la metodología incorrecta. Las pruebas frequentist clásicas funcionan con tamaño de muestra fijo y lógica de horizonte fijo: comienzas la prueba, esperas 2-4 semanas, no tocas nada hasta alcanzar el umbral de p-value. Durante este periodo, aunque la variante ganadora ya sea evidente, no puedes tomar decisiones. El enfoque Bayesiano cambia este punto crítico: puedes evaluar la decisión en cualquier momento con probabilidad posterior, realizar testing secuencial, mantener el tamaño de muestra dinámico. Que Google cierre Optimize no eliminó este método, al contrario, abrió el camino para integrarlo en tu propio stack.

## La trampa del tiempo en las pruebas frequentist

La lógica clásica de prueba A/B funciona con este supuesto: el test debe continuar hasta que el p-value caiga por debajo de 0.05; si haces un peek intermedio (control intermedio), aumentas el riesgo de falso positivo. Esto es teóricamente correcto pero genera dos problemas prácticos. Primero: cuando quieres detener la prueba temprano, no tienes una guardia estadística, así que el riesgo de decisión incorrecta es alto. Segundo: aunque la variante ganadora sea evidente desde temprano, estás obligado a esperar hasta completar el tamaño de muestra fijo — este periodo oscila entre 14-21 días en promedio.

Detrás de este enfoque está el marco de prueba de hipótesis de Neyman-Pearson: tomas la decisión de rechazar o aceptar la hipótesis nula a partir de un único umbral (generalmente α=0.05). El problema es que este umbral depende de un cálculo de tamaño de muestra fijo, por lo que no te permite tomar decisiones dinámicas durante el proceso. Por ejemplo, si la variante B muestra 18% de conversión mientras el control está en 12%, y esta diferencia surge después de 500 usuarios, el marco frequentist dice "espera más, no has alcanzado los 2000 usuarios planeados".

Este problema se intensifica en las pruebas de aplicaciones móviles. Si tu aplicación tiene 5000 usuarios activos diarios (DAU) y necesitas detectar un uplift del 2%, el tamaño de muestra requerido es ~8000 usuarios — esto significa 2 semanas. Pero si la señal ganadora aparece el día 3, estás enviando tráfico a la variante perdedora durante 11 días más. Estos días representan oportunidades de ganancia perdidas (opportunity cost).

## Enfoque Bayesiano: actualización continua con probabilidad posterior

La estadística Bayesiana hace una pregunta diferente: "¿Cuál es la probabilidad de que esta variante sea mejor que el grupo de control?" La respuesta no es un p-value, sino una distribución de probabilidad posterior. Cada nuevo punto de datos (cada nuevo usuario) actualiza tu creencia previa calculando nuevamente el posterior. Esto permite "la probabilidad de que la variante B tenga una tasa de conversión más alta que el control es 95%" — y esta afirmación permite testing secuencial.

Matemáticamente, el teorema de Bayes funciona con esta fórmula:

```
P(θ|data) = P(data|θ) × P(θ) / P(data)
```

Aquí `θ` es la tasa de conversión, `P(θ)` es el prior (tu creencia inicial), `P(data|θ)` es la verosimilitud (probabilidad de los datos observados bajo θ), y `P(θ|data)` es el posterior (tu creencia actualizada). Por ejemplo, si usas Beta(1,1) como prior — una distribución uniforme — cada conversión suma +1 al parámetro `α`, cada bounce suma +1 al parámetro `β`. 100 visitantes, 18 conversiones = Beta(19, 83). Comparas esta distribución posterior con el posterior del grupo de control para calcular "probabilidad de que B > A".

El artículo de 2015 de Chris Stucchio en VWO fue uno de los primeros case studies que llevó esta lógica a producción: cuando ejecutas la misma prueba de forma Bayesiana, obtienes resultados 40% más rápido en promedio porque el riesgo de detención temprana está bajo control. El framework de experimentación interno de Google también comenzó a usar posteriors Bayesianos como métrica intermedia desde 2018 en adelante (sin documentación pública, pero mencionado en el libro de Kohavi et al.).

### Testing secuencial y regla de parada

La mayor ventaja del enfoque Bayesiano es que puedes hacer testing secuencial. En frequentist, calcular p-values en controles intermedios infla el error Tipo I (problema de comparaciones múltiples). En Bayesiano, la probabilidad posterior es siempre una métrica válida porque es un estado de creencia continuamente actualizado. Esto permite verificar "probabilidad posterior de B > A" cada día, detener la prueba cuando supera 95%.

La regla de parada funciona así:

1. Define un tamaño de muestra mínimo (por ejemplo, 200 usuarios por variante — para filtrar ruido temprano)
2. Actualiza los posteriors cada día
3. Cuando `P(variante_B > control) > 0.95`, detén la prueba
4. Si no alcanzas 95% después de 14 días, marca como "inconcluso"

Usamos este enfoque en nuestros procesos de [Optimización de Tasa de Conversión](https://www.roibase.com.tr/es/cro): definir el prior al inicio, actualizar automáticamente el posterior cada día, establecer el umbral de la regla de parada junto con el equipo de ingeniería. Por ejemplo, en una prueba de flujo de checkout de e-commerce usamos 98% en lugar de 95% porque el costo de un falso positivo es alto — cualquier cambio en la página de pago afecta directamente el volumen de transacciones.

## Tamaño de muestra dinámico y cálculo de pérdida esperada

En las pruebas frequentist, el cálculo del tamaño de muestra se hace de antemano con análisis de potencia: proporcionas el efecto mínimo detectable (MDE), potencia estadística (80%), nivel de significancia (α=0.05), y esperas el número resultante. En Bayesiano, el tamaño de muestra es dinámico porque el posterior puede llevarte a una conclusión temprana. Pero esto no significa "detente cuando quieras" — entra en juego el concepto de pérdida esperada.

La pérdida esperada es el costo previsto de tomar una decisión incorrecta. Digamos que tu posterior muestra que la variante B tiene 92% de probabilidad de ganar. Pero existe un 8% de probabilidad de que A sea mejor, y si eliges B cometes un error, sufrirás una pérdida de uplift. La pérdida esperada convierte este escenario en un número:

```
E[Loss_B] = ∫ max(0, θ_A - θ_B) × P(θ_A, θ_B | data) dθ
```

En términos prácticos: "Si elijo B y me equivoco, la pérdida esperada es 0.3 puntos de tasa de conversión". Este valor se puede convertir a dinero — por ejemplo, 10,000 sesiones diarias, pérdida de 0.3% = 30 conversiones perdidas = multiplicado por el valor promedio del pedido para obtener el costo diario.

La calculadora de "Bayesian A/B Testing Calculator" de Evan Miller automatiza este cálculo: proporcionas conteos de conversión + tamaño de muestra para control y variante, y devuelve posterior + pérdida esperada + probabilidad de ser la mejor variante. Esta herramienta no es suficiente para producción pero es ideal para entender el concepto. En producción, usamos librerías como `pymc` en Python o `rstan` en R para muestreo posterior y calculamos la pérdida esperada con Monte Carlo.

### Perspectiva de minimización de arrepentimiento

Hay un concepto de la literatura de multi-armed bandit: el arrepentimiento (regret). En pruebas A/B, el regret es la pérdida total por no elegir la variante óptima. El testing secuencial Bayesiano intenta minimizarlo porque puede tomar decisiones rápidamente cuando surge la señal ganadora. En frequentist, el regret crece linealmente durante la duración de la prueba (porque sigues enviando tráfico a la variante perdedora), en Bayesiano es sublineal — porque te detienes temprano.

El cálculo del regret es crítico en pruebas de landing page de e-commerce. Por ejemplo, en una campaña de Black Friday tienes una ventana de test de 48 horas. La planificación frequentist requiere 2000 usuarios de tamaño de muestra, y si el tráfico diario es 3000, es posible que no completes la prueba. En Bayesiano, si puedes tomar una decisión con 97% posterior después de 12 horas, abres la variante ganadora al 100% del tráfico durante las 36 horas restantes y reduces el regret a cero.

## Aplicación: Pipeline de prueba A/B Bayesiano con Python

Pasando de la teoría a la práctica, veamos cómo llevar las pruebas Bayesianas a producción. El siguiente código obtiene datos de prueba de BigQuery, calcula el posterior y verifica la regla de parada:

```python
import numpy as np
from scipy.stats import beta

def calculate_posterior(conversions, trials, prior_alpha=1, prior_beta=1):
    """Calcula posterior con prior conjugado Beta-Binomial"""
    return beta(prior_alpha + conversions, prior_beta + trials - conversions)

def prob_b_beats_a(posterior_a, posterior_b, samples=100000):
    """Calcula P(B > A) con Monte Carlo"""
    samples_a = posterior_a.rvs(samples)
    samples_b = posterior_b.rvs(samples)
    return (samples_b > samples_a).mean()

def expected_loss(posterior_a, posterior_b, samples=100000):
    """Pérdida esperada si eliges B"""
    samples_a = posterior_a.rvs(samples)
    samples_b = posterior_b.rvs(samples)
    loss = np.maximum(0, samples_a - samples_b)
    return loss.mean()

# Datos de ejemplo: Control 1000 sesiones / 120 conversiones, Variante 1000 / 145
posterior_control = calculate_posterior(120, 1000)
posterior_variant = calculate_posterior(145, 1000)

prob_win = prob_b_beats_a(posterior_control, posterior_variant)
loss_variant = expected_loss(posterior_control, posterior_variant)

print(f"P(Variante > Control): {prob_win:.3f}")
print(f"Pérdida esperada si eliges Variante: {loss_variant:.4f}")

# Regla de parada
if prob_win > 0.95 and loss_variant < 0.01:
    print("LANZAR VARIANTE")
elif prob_win < 0.05:
    print("LANZAR CONTROL")
else:
    print("CONTINUAR PRUEBA")
```

Puedes incrustar este código dentro de un modelo dbt, ejecutarlo con un schedule diario. Si tienes una tabla en BigQuery con test_id, variant, session_count, conversion_count, puedes calcular el posterior como una UDF de Python y escribir el resultado en una nueva tabla. Cuando la conectas a un dashboard de Looker o Metabase, tu equipo de producto ve el gráfico posterior en tiempo real.

## Trade-offs y cuándo mantenerse en frequentist

El enfoque Bayesiano no es superior en todas las situaciones. Hay tres escenarios donde consideramos otras opciones:

**1. Pruebas con cumplimiento regulatorio:** En ensayos farmacéuticos, sector financiero, modelos de precios de seguros, el p-value frequentist es el estándar aceptado por reguladores como FDA/EMA. Si usas posterior Bayesiano necesitas documentación adicional.

**2. Base rate muy baja:** Por ejemplo, una página de funnel con tasa de conversión de 0.5%. El prior Bayesiano se vuelve crítico, y si usas un prior no informativo (Beta(1,1)) separar ruido de señal es difícil; si usas prior informativo, existe riesgo de sesgo subjetivo. En estos casos frequentist parece más "seguro".

**3. Campañas grandes únicas:** Como una prueba anual de landing page en Black Friday. Si haces detención temprana Bayesiana y te equivocas, no puedes revertir porque la campaña ya terminó. Aquí frequentist conservador + corrección de Bonferroni es preferible.

Pero fuera de estas excepciones — especialmente en SaaS, e-commerce y aplicaciones móviles donde la iteración es continua — la ganancia de velocidad con Bayesiano es clara. Netflix, Booking.com, Spotify usan Bayesiano internamente (lo mencionan en sus blogs de tecnología).

## Acelerar la velocidad de decisión

La prueba A/B Bayesiana no es solo un cambio estadístico, es rediseñar tu proceso de decisión. Cuando la probabilidad posterior se convierte en una métrica actualizada diariamente, tu pipeline de prueba se ve así: lanzas la prueba el lunes, el posterior alcanza 92% el miércoles, llega a 96% el jueves — tomas la decisión inmediatamente. Con frequentist, la misma prueba tomaría 2 semanas. Ganar 10 días = 10 días más de iteración = 20-30 pruebas adicionales por año.

Para capturar esta ventaja de velocidad, construye tu stack nativo a Bayesiano: BigQuery + UDF en Python + dashboard en Looker + alertas en Slack. Establece el umbral de pérdida esperada con tu CFO (por ejemplo, máximo 0.5% del revenue diario). Para seleccionar priors usa el conocimiento del dominio pero evita la sobre-confianza — en la mayoría de casos Beta(2,2) es un buen inicio. Integra el pensamiento de testing secuencial en tu roadmap de producto: si inicias 3 pruebas en el sprint, con Bayesiano puedes cerrar 2 a mitad del sprint y lanzar nuevas pruebas.

En el marketing de rendimiento, gana quien se mueve rápido. El enfoque Bayesiano te da esa velocidad sin sacrificar el rigor estadístico.