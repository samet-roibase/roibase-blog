---
title: "MMM + Incrementality: El setup de atribución de 2026"
description: "Robyn, Meta Lift, geo experiments — ¿cuándo usar cada uno? Árbol de decisión práctico para atribución post-cookie."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, atribución, robyn, geo-test]
readingTime: 8
author: Roibase
---

El 80% del tracking de cookies desapareció, Multi-Touch Attribution (MTA) ya no es fiable, los dashboards de plataformas se contradicen entre sí. En 2026, los marketers miden la "contribución" combinando dos métodos: Marketing Mix Modeling (MMM) y tests de incrementalidad. El problema: pocos saben cuándo usar cada uno. Este artículo muestra dónde encajan Robyn (la librería MMM open source de Meta), la Meta Lift API y los tests basados en geo dentro del mismo setup.

## Last-touch attribution está muerto — pero ¿qué lo reemplaza?

Google Analytics 4 dice "data-driven attribution", Meta dice "modeled conversions", TikTok da su propio número. Los tres reportan cifras diferentes. En 2025, un ecommerce que gasta 100 dólares ve 8 conversiones en GA4, 12 en Meta y 6 en TikTok. ¿Cuál canal realmente funciona? Last-touch no puede responder porque un usuario pasa por múltiples touchpoints y cada plataforma se da crédito a sí misma.

Marketing Mix Modeling resuelve esto de otro ángulo: toma los canales como variables independientes, la venta o revenue como variable dependiente, calcula la contribución marginal de cada canal mediante regresión. Los tests de incrementalidad van más al grano: expones un grupo a un canal, otro grupo no, y mides la diferencia. Ambos rompen la ilusión del último clic, pero sus escenarios de uso no se solapan.

La diferencia radica aquí: MMM es macro (largo plazo, todos los canales), incrementalidad es micro (corto plazo, canal o campaña específica). Un setup que combine ambos es estándar en 2026.

## MMM: setup de regresión semanal con Robyn

Robyn es el framework MMM open source del equipo Facebook Marketing Science de Meta. Usa R, regresión Bayesian ridge, y ajusta automáticamente curvas de adstock (efecto retardado) y saturation (rendimientos decrecientes). Con granularidad semanal, devuelve el porcentaje de contribución de cada canal (TV, display, paid social, SEO, email) a las ventas.

**Las 4 capas del setup Robyn:**

1. **Recopilación de datos:** Mínimo 1,5 años de datos semanales. Cada fila = una semana. Columnas: gasto por canal, impresiones o clicks; variables independientes (precio, stock, estacionalidad); variable dependiente (revenue, órdenes, conversiones). Sin datos, el modelo no funciona.
2. **Tuning de hiperparámetros:** Robyn busca para cada canal los parámetros de adstock decay (α) y saturation shape (γ). Ejecuta 2000+ combinaciones de modelos y sugiere los 5-10 mejores de la frontera de Pareto. Esta fase tarda 10-30 minutos (en 64 cores).
3. **Selección del modelo:** Tomas el modelo con el NRMSE más bajo (Normalized Root Mean Squared Error) + la decomp.rssd más alta (estabilidad de descomposición). El output: porcentaje de contribución de cada canal a las ventas totales, estimación de ROI, asignación óptima de presupuesto.
4. **Asignación de presupuesto:** La función "budget allocator" de Robyn redistribuye el presupuesto total — igualando el ROI marginal de cada canal. Este output te sirve para planificar el próximo trimestre.

**Cuándo usar Robyn:**
- Decisiones de asignación presupuestaria intercanal (por ej., plan Q3)
- Simulación de agregar/eliminar un canal nuevo
- Análisis de tendencias a largo plazo (6+ meses)

**Cuándo NO usar Robyn:**
- Optimizar dentro de una campaña (periodos < 2 semanas)
- Decisiones de creative test específico de plataforma (MMM no ve diferencias de creative)
- Feedback en tiempo real (hay 1 semana de lag)

Roibase integra Robyn en nuestro servicio de [Dijital Pazarlama](https://www.roibase.com.tr/es/dijitalpazarlama): conectamos GA4, GTM server-side, Meta CAPI y BigQuery, construimos un pipeline ETL semanal, y visualizamos el output en Data Studio.

## Tests de incrementalidad: Meta Lift y geo-based holdout

MMM responde "cuánto", los tests de incrementalidad responden "¿realmente funciona?" Dos preguntas distintas. Si gastas 100k TL en Meta y obtienes 120 conversiones, ¿está "bien"? MMM te dice "Meta toma el 15% de tu presupuesto, genera el 12% de las ventas totales". ¿Pero cuántas conversiones habrían ocurrido de todas formas (organic)? Para eso necesitas un test de incrementalidad.

### Meta Conversion Lift

Meta Lift API mide el **impacto real** de tus anuncios en Facebook e Instagram. ¿Cómo? Muestra la campaña a un grupo holdout pequeño, a otro no, y mide la diferencia 7-14 días después. La diferencia = conversiones incrementales.

**Setup:**
- Antes de lanzar, abres un Lift study (Ads Manager > Measure & Report > Conversion Lift)
- El ratio de holdout es 5-10% (muy pequeño = ruido, muy grande = pérdida de impresiones)
- Duración mínima: 7 días (más corto = poder estadístico bajo)
- Resultado: conversiones incrementales, CPA incremental, intervalo de confianza

**Ejemplo de interpretación:**
Control group: 1000 personas, 40 conversiones
Test group: 9000 personas, 450 conversiones
Conversión incremental = (450/9000 - 40/1000) × 9000 = 90 conversiones
Lift = 90 / (450 - 90) = 25%

Entonces, de las 450 conversiones vistas por la campaña, solo 90 vinieron realmente del anuncio. El resto habría ocurrido de todos modos. CPA incremental = (gasto) / 90. Este número es 30-60% más alto que MTA — porque es real.

**Cuándo usar Meta Lift:**
- A/B test de nuevas campañas o creatividades
- Decisión de plataforma (¿Meta vs. Google vs. TikTok cuál es más incremental?)
- Medir el impacto real del retargeting (problema común: retargeting siempre aparece con CPA bajo, pero 80% habría comprado igual)

**Desventaja:**
- Solo funciona en Meta (Google Display & Video 360 tiene equivalente limitado)
- Crear un grupo holdout cuesta impresiones (revenue cae a corto plazo)
- Test mínimo 1 semana — no sirve para decisiones diarias

### Geo-based experiments (holdout geográfico)

Para canales fuera de Meta (Google, TikTok, TV), corres tests basados en geografía: abres campaña en algunas ciudades, la cierras en otras, observas la diferencia en ventas. Es el método más limpio académicamente porque no hay manipulación a nivel de usuario.

**Ejemplo de setup:**
- Selecciona 30 ciudades (población y nivel económico similares)
- Abre campaña de Google Ads en 15, mantenla cerrada en 15 (aleatorizadas)
- Espera 4 semanas
- Compara conversiones por ciudad en Google Analytics 4

**Análisis:**
- Ciudades tratadas: promedio 120 conversiones/ciudad
- Ciudades control: promedio 95 conversiones/ciudad
- Lift incremental: (120 - 95) / 95 = 26.3%

Extrapolas este 26.3% de lift a todo el país. Con presupuesto de Google Ads de 200k TL, calculas revenue incremental e iROAS incremental.

**Cuándo usar geo test:**
- Medir la contribución neta de cada canal en setup multicanal
- Ver impacto de canales no digitales (TV, OOH, podcast)
- Cuando no confías en los dashboards de plataformas

**Desventaja:**
- Pocas ciudades = poder estadístico bajo (mínimo 20 ciudades)
- Heterogeneidad geográfica sesgada (İstanbul ≠ Şanlıurfa, no se puede meter en el mismo bucket)
- Largo: 4-8 semanas

## Árbol de decisión: cuándo usar cada método

En el mismo setup, organizamos los tres métodos así:

| Escenario | Método | Frecuencia | Output |
|-----------|--------|-----------|--------|
| Asignación presupuestaria quarterly | Robyn MMM | Cada 3 meses | ROI por canal, asignación óptima |
| Test de nueva campaña (Meta/Instagram) | Meta Lift | Cada campaña grande | CPA incremental |
| Incrementalidad cross-channel | Geo-based holdout | 2 veces/año | Lift real por canal |
| Decisión de refresh creativo | Meta Lift + CRO | 1 vez/mes | Qué creativo es incremental |
| Ajuste en tiempo real | API de plataforma (ROAS feedback) | Diario | Optimización táctica |

**Flujo práctico:**
1. **Semanal:** Monitorea dashboards de plataforma (parecido a MTA, pero sin confiar ciegamente)
2. **Mensual:** Prueba campañas grandes con Meta Lift
3. **Quarterly:** Ejecuta Robyn sobre todos los canales, realoca presupuesto basado en largo plazo
4. **2 veces/año:** Valida el lift real de cada canal con geo test

Este setup de 3 capas te permite tomar decisiones tácticas (qué creativo funciona) y estratégicas (cuánto presupuesto por canal) con datos.

## Malentendidos comunes y tradeoffs

**Malentendido 1:** "Si haces MMM no necesitas test de incrementalidad"
Falso. MMM muestra correlación, asume causalidad. El test de incrementalidad mide causalidad. Se complementan. Ejemplo: MMM dice "Instagram contribuye 15%", pero Lift test muestra que 40% de eso sería orgánico. La contribución real es 9%.

**Malentendido 2:** "Todo test de incrementalidad se hace en cada campaña"
Falso. Crear un holdout cuesta impresiones. Solo lo haces para decisiones grandes (nuevo canal, nueva dirección creativa, estrategia de retargeting). Las micro-optimizaciones usan A/B test.

**Malentendido 3:** "Robyn se configura una vez y luego es automático"
Falso. El modelo se reentren cada trimestre. Si agregas canal, cambia precio, o varía estacionalidad, el modelo se actualiza. Robyn es mantenimiento continuo.

**Tradeoff 1: Velocidad vs. precisión**
MMM requiere 1,5 años de datos, resultado con 1 semana de lag. Geo test tarda 4-8 semanas. Si necesitas decisión rápida, confiarás en dashboards de plataforma pero aceptarás 30-50% de margen de error.

**Tradeoff 2: Granularidad vs. tamaño de muestra**
Geo test por ciudad = pequeño sample size, IC amplio. Por municipio = heterogeneidad aumenta. MMM semanal no responde preguntas diarias. Cada método tiene límite de resolución.

## Cómo se construye el stack de atribución en 2026

El setup técnico consta de:

1. **GTM server-side + first-party cookie:** Envía señales limpias a GA4 y Meta CAPI (no ATT bypass, sino data enrichment basada en consentimiento)
2. **Data warehouse BigQuery:** Centraliza todos los datos de plataformas (GA4, Meta Ads API, Google Ads API, TikTok Ads API, CRM)
3. **dbt transformation:** Genera tablas semanales agregadas (cada fila = 1 semana, cada columna = gasto de 1 canal + 1 outcome)
4. **Pipeline Robyn:** Script R en Cloud Run ejecutado semanalmente, output en BigQuery
5. **Dashboard Looker Studio:** MMM output + MTA de plataformas + resultados de tests de incrementalidad lado a lado
6. **Alertas Slack:** Si NRMSE de modelo sube >10%, aviso de anomalía en datos

Armar este stack tarda 4-6 semanas. Después, mantenimiento semanal de 2-3 horas. ROI: asignación presupuestaria 15-25% más eficiente (Robyn reporta 18% mejora en su benchmark).

## Qué hacer ahora

Si aún decides basado en last-touch attribution, no competirás en 2026. Primer paso: envía datos de plataformas a BigQuery, crea tabla semanal con 1,5 años de historial. Segundo paso: configura Robyn, entrena el primer modelo. Tercer paso: en la próxima campaña grande, abre Meta Lift study. Cuarto paso: en 6 meses, valida con geo test. Estos 4 pasos transforman tu attribution stack desde la ilusión MTA hacia fundamentación en incrementalidad real.