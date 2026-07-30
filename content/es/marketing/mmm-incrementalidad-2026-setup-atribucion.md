---
title: "MMM + Incrementalidad: El Setup de Atribución de 2026"
description: "Robyn, Meta Lift, experimentos geo — cuándo usar cada uno. Las nuevas capas de medición de impacto de marketing en la era post-cookie."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementalidad, atribución, robyn, meta-lift]
readingTime: 8
author: Roibase
---

En la era post-cookie, el atribución de último clic desapareció como un fantasma. En 2026, los equipos de marketing ya no responden "qué canal trajo la conversión" sino "sin qué canal la conversión no hubiera llegado". Este cambio de paradigma se llama incrementalidad. Pero medir incrementalidad por sí solo no basta — no ves el impacto de marca a largo plazo. Aquí entra el Marketing Mix Modeling (MMM). El stack de atribución saludable de 2026 tiene dos capas: MMM e incrementalidad testing. Robyn de Meta, Meta Lift, la infraestructura de experimentos geo de Google — los tres responden preguntas diferentes. En este artículo veremos cuándo usar cada herramienta, cómo trabajan juntos y qué trampas evitar durante la implementación.

## MMM: El Mapa de Impacto a Largo Plazo

Marketing Mix Modeling es un método basado en regresión — combina datos históricos de gasto, exposición de medios y ventas para calcular la contribución de cada canal a las ventas. El framework open-source Robyn de Meta salió en 2022 pero alcanzó madurez en producción en 2025-2026. Robyn modela adstock (cómo disminuye el efecto publicitario con el tiempo) y curvas de saturación (rendimientos decrecientes del gasto creciente) para optimizar la asignación presupuestaria entre canales.

La fortaleza de MMM: captura el efecto de marca. Un patrocinio de podcast tal vez no genere conversiones esta semana pero puede aumentar búsquedas orgánicas durante 6 semanas. Last-click no ve esa contribución, MMM sí. La debilidad: no hay granularidad. MMM te dice "gasta 50.000 TL más mensuales en Meta" pero no "en qué campaña, con qué creative". Además, MMM mira hacia atrás — no puede optimizar en tiempo real.

Para implementar Robyn correctamente necesitas mínimo 2 años de datos semanales (104 filas). Tu dataset debe incluir: gasto por canal (Google Ads, Meta, TikTok, podcast, TV por separado), ventas totales (ingresos o volumen), cambios de precio, efectos de estacionalidad y festivos. Robyn usa Nevergrad para tuning de hiperparámetros — ejecuta 100.000+ modelos y encuentra el mejor fit. El output: mROAS (marginal ROAS) y punto de saturación por cada canal. Ejemplo: Meta mROAS 3.2 pero el gasto por encima de 100.000 TL cae a 1.8. Este tradeoff en producción guía la asignación presupuestaria del [marketing de performance](https://www.roibase.com.tr/es/ppc).

## Incrementalidad Testing: Causalidad a Corto Plazo

MMM muestra correlación, incrementalidad prueba causalidad. Un test de incrementalidad responde una pregunta simple: ¿qué pierdo si apago esta campaña? El método más común es el holdout basado en geografía. En EE.UU., tomas 50 estados, 25 son tratamiento (campaña activa), 25 control (campaña apagada) y mides la diferencia en ventas. La infraestructura GeoX de Google Ads automatiza esto — seleccionas una campaña, haces un split geo y en 2-4 semanas obtienes un reporte de lift.

El test de Conversion Lift de Meta hace holdout a nivel de usuario. Abres un "lift study" en Meta Ads Manager, Meta separa el 10% del tráfico al grupo control (sin anuncios), el 90% al tratamiento. Al terminar el test, Meta te dice: tasa de conversión en tratamiento 2.3%, en control 1.9% — lift 21%. Esto significa que la contribución incrmental real de la campaña es 21%, el resto 79% eran conversiones que hubieran ocurrido igualmente (orgánico, remarketing, búsqueda).

La debilidad del test de incrementalidad: es caro y lento. Un test geo toma mínimo 2 semanas, un test a nivel de usuario 4-6 semanas. Durante el test, no gastas en el grupo control — hay pérdida potencial. Tampoco puedes testear cada campaña, solo las estratégicas (nuevo formato creativo, plataforma nueva, campaña upper-funnel). Pero sin incrementalidad no puedes validar resultados de MMM — MMM dice "Meta ROAS 4.2" pero un lift test puede decir "no, el lift real es 18%, ROAS 1.6". Los dos juntos dan la verdad.

### Estrategia de Holdout y Tamaño de Muestra

El éxito de un test geo comienza con el cálculo de tamaño de muestra. Google GeoX recomienda mínimo 40 geos (ciudades/estados) — 20 tratamiento, 20 control. Con menos geos, el poder estadístico es insuficiente, no llega significancia. Para Meta Lift, el requisito mínimo es 50+ conversiones diarias. Con menos, el intervalo de confianza es muy ancho — el lift puede estar entre 10% y 40%, no puedes decidir.

Al definir la duración del test, ten en cuenta seasonality. Si el tráfico viernes-domingo es 30% más que lunes-jueves, ajusta el test en semanas completas (2 o 4 semanas). También está el efecto spillover: un usuario en tratamiento geo puede viajar a otro estado y convertirse. Esto genera ruido en control, el lift sale más bajo que real. Para mitigarlo, establece límites geo estrictos (área metro en lugar de estado) o testea en categorías donde la movilidad inter-geo es baja (servicios locales, QSR).

## MMM + Incrementalidad Trabajando Juntos

Piénsalos como capas que se validan mutuamente. MMM da asignación presupuestaria a largo plazo, los tests de incrementalidad la validan. El flujo es así:

1. **Ejecuta MMM** — crea un modelo Robyn con 2 años de datos, calcula mROAS por canal.
2. **Ajusta presupuesto según output de MMM** — si MMM dice "duplica gasto en podcast", aumenta presupuesto de podcast.
3. **Abre test de incrementalidad en canal crítico** — testea podcast 4 semanas con split geo.
4. **Compara lift result con MMM** — MMM dijo "podcast ROAS 5.2", el test de lift dice "lift real 25%, ROAS 3.1" → calibra MMM.
5. **Cierra el ciclo** — usa el nuevo dato de lift como prior en Robyn, refina el modelo.

Este ciclo se repite cada 3 meses. MMM se reejcuta cada trimestre (agrega 13 semanas nuevas), los tests de incrementalidad rotan 1-2 canales mensuales. Resultado: mix presupuestario correcto a nivel macro y prueba causal a nivel micro.

Un ejemplo: brand e-commerce, MMM muestra Google Search ROAS 8.2 — el canal más rentable. Pero cuando abren Meta Lift test, ven que el 60% del tráfico de Search son búsquedas de marca que llegarían igual sin anuncios. Lift incremental real 15%, ROAS 2.4. Con esta información, reducen presupuesto de Search y reasignan a upper-funnel (YouTube, podcast). Cuando re-ejecutan MMM 2 trimestres después, el tráfico orgánico de búsqueda de marca subió 18% — el efecto rezagado del podcast aparece ahora en el modelo.

## Qué Herramienta Usar Cuándo

**Usa Robyn (MMM):**
- Entras a un mercado nuevo, no sabes en qué canales invertir.
- Tienes gasto en 5+ canales y quieres realinear presupuesto.
- Quieres medir el impacto a largo plazo de campañas de marca (TV, podcast, influencers).
- Tienes mínimo 2 años de datos de ventas + gasto semanales.

**Usa Meta Lift:**
- Estás testeando un nuevo formato creativo en Meta (Reels, Advantage+ catalog).
- Abriste una campaña upper-funnel, quieres probar su contribución a conversión.
- Tienes 50+ conversiones diarias, puedes tolerar 4-6 semanas de test.
- Puedes asumir el costo de no gastar en el grupo control.

**Usa Google GeoX (experimento geo):**
- Estás testeando split brand vs. non-brand en Google Ads.
- Tienes gasto en múltiples plataformas (Google + Meta + TikTok), quieres incrementalidad cross-channel.
- En tu país hay suficiente tráfico para split geo (ciudades/regiones independientes testables).

Si tu presupuesto es limitado y elegirás una sola herramienta: **comienza con un test de incrementalidad** (Meta Lift o GeoX). Porque da insights accionables inmediatamente — puede decirte "apaga esta campaña, ahorra 30%". MMM es más estratégico pero requiere más interpretación. Mundo ideal: ejecuta ambas y que se alimenten mutuamente.

## Trampas de Setup y Calibración

**Trampas de MMM:**
- **Datos insuficientes:** No ejecutes Robyn con menos de 52 semanas — el modelo overfitea.
- **Variables faltantes:** Si no incluyes promociones de precio o gastos de competidores, la contribución del canal se infla.
- **Adstock mal calibrado:** No uses el mismo adstock decay para todos los canales. TV tiene 8 semanas, Meta 2 semanas — dale priors a Robyn.
- **Ignorar saturación:** Robyn usa curva de saturación logarítmica por defecto pero algunos canales (brand search) son lineales. Ajusta el tipo de curva según fit del modelo.

**Trampas de incrementalidad:**
- **Duración de test corta:** Un test de lift de 1 semana no da poder estadístico. Mínimo 2 semanas (geo), 4 semanas (user-level).
- **Contaminación:** Si treatment y control están en la misma localidad ocurre spillover. Los límites geo deben ser netos.
- **Ruido de seasonality:** Si abres el test en Black Friday, el lift puede ser 2x del real. Elige semanas normales.
- **Attribution window equivocado:** Meta Lift usa default 7-day click, 1-day view. Si tu ciclo de venta es largo (B2B, precio alto), abre ventana 28-day.

Para calibrar: compara el ROAS predicho por MMM con el ROAS real del test de lift. Si la diferencia es >20%, revisa los priors de MMM (adstock, saturación). En Robyn puedes estrechar el rango de búsqueda con `hyperparameter_bounds` — en lugar de [0.3, 0.8] para adstock decay usa [0.4, 0.6]. Esta iteración toma 2-3 trimestres pero al final MMM e incrementalidad están alineados.

## A Dónde Va en 2026

A fines de 2026, el 40% de los tests de incrementalidad migran a métodos Bayesianos. Mientras un test clásico espera "p < 0.05", un test Bayesiano permite early stopping — si la probabilidad posterior supera 95% en el día 10, puedes detener el test. Meta ya abrió beta de Conversion Lift Bayesiano. Google GeoX aún no, pero se espera para 2027.

En MMM, la integración de inferencia causal (notación de Pearl, DAG) llega a Robyn. Actualmente Robyn es basado en correlación — si dos canales sube al mismo tiempo (ambos por Black Friday) Robyn no puede separar efectos. Un MMM causal (Econometric + Causal Impact hybrid) resuelve esto. Se espera madurez en producción en 2027.

Un punto final: el stack de incrementalidad + MMM no es solo para paid media. Empezó a usarse también en retention y lifecycle marketing. Combinaciones como Braze + GeoX miden el impacto incrmental de campañas email. Holdout a nivel de usuario mide el lift de push notifications. Attribution ya no es solo adquisición, cubre el full journey del cliente. En 2026, equipos sin este stack gastan a ciegas — los que lo tienen optimizan cada TL con disciplina de ingeniería.