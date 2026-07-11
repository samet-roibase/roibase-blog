---
title: "MMM + Incrementality: El Setup de Attribution de 2026"
description: "Robyn, Meta Lift y geo experiments: cuál usar cuándo en medición post-cookie, test setups y árbol de decisión."
publishedAt: 2026-07-11
modifiedAt: 2026-07-11
category: marketing
i18nKey: marketing-004-2026-07
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 9
author: Roibase
---

La medición de marketing post-cookie redefinió el significado de "attribution". En 2026 ya no se trata de rastrear qué usuario vio qué anuncio, sino aislar qué canal generó un incremento real en ventas. Marketing Mix Modeling (MMM) e incrementality testing son las herramientas fundamentales del nuevo juego — pero ambas responden la misma pregunta en horizontes temporales distintos y con niveles de confianza diferentes. Robyn de Meta, Conversion Lift tests y experimentos geo-basados ofrecen cada uno soluciones diferentes, y la elección depende del timing de tu campaña, flexibilidad presupuestaria y madurez de datos.

## MMM: Leer el Pasado para Predecir el Futuro

Marketing Mix Modeling es una familia de métodos de regresión. Toma 2-3 años de histórico de gasto, impresiones, factores macroeconómicos y ventas, aislando la contribución de cada canal al total de ventas. Frameworks open-source como Robyn aplican optimización Bayesiana para calibrar automáticamente los hiperparámetros del modelo (adstock, curvas de saturación).

El output de Robyn es un conjunto de "response curves": para cada canal, muestra el ROAS marginal cuando aumentas el gasto. Por ejemplo, si destinas 100.000 TL adicionales a Meta, esperas un ROAS de 3.2; pero si ese dinero va a Google Search, obtienes 4.1. Para estas decisiones se necesita el histórico consolidado de MMM. En 2026, Robyn v4.1 automatiza la descomposición de estacionalidad basada en Prophet y parsea efectos de holidays; los dummies manuales de eventos de calendario ya están deprecados.

La debilidad de MMM es la latencia: configurar el modelo toma 4-6 semanas porque requiere mínimo 100-120 semanas de datos (2+ años). Si abriste un canal nuevo (por ejemplo, TikTok), los primeros 12 meses de datos son extremadamente ruidosos; MMM no puede asignarle coeficientes confiables. Aquí entra en juego el testing de incrementality de corto plazo.

## Meta Conversion Lift: Rápido, Acotado, Costoso

Meta Conversion Lift (antes Lift Studies) funciona como un randomized controlled trial: divide usuarios entre grupo test (ve anuncios) y control (ve PSAs), calcula la diferencia en conversiones. Obtienes resultados en 2-4 semanas — mucho más rápido que MMM para decisiones de corto plazo.

El costo del Lift test: mínimo 200.000 usuarios alcanzados y debes "gastar" 5-10% del presupuesto normal de la campaña en el grupo control. En práctica, esto significa 50.000-100.000 TL en impressiones desperdiciadas, porque el grupo control ve PSAs pero sus conversiones no se cuentan en el evento de conversión. Meta no reembolsa ese gasto — es el costo de validación.

En 2026, Meta integró Conversion Lift con eventos server-side: los eventos `Purchase` enviados vía CAPI se usan directamente en el cálculo de lift. Incluso para usuarios iOS 17+ obtienes resultados confiables porque la asignación test/control está vinculada a IDs server-side. La única limitación: Lift mide solo la plataforma Meta — no captures el efecto halo entre canales. Si tu campaña en Instagram incrementa búsquedas orgánicas en Google Search, Lift no lo ve.

## Geo Experiments: Capturar el Halo Cross-Channel

Los geo experiments comparan tratamiento vs. control por ciudad/región. Por ejemplo, aumentas gasto en Meta un 30% en Estambul y Ankara, mantienes constante en Esmirna y Bursa. Después de 4-6 semanas, observas el delta en ventas totales — este método captura spillover entre canales.

Google GeoX automatiza esto: usa synthetic control method para construir una "curva de ventas contrafáctica" para cada geo de test. En práctica, estima las ventas de Estambul como el promedio ponderado de 5-6 ciudades con demografía y estacionalidad similares. La diferencia entre ventas reales post-tratamiento y esta estimación es la incrementality.

La ventaja de geo testing: incluye todos los canales online y offline. La desventaja: riesgo de spillover geográfico (tu anuncio en Estambul impacta en Kocaeli) y diferencias en tamaño de mercado. Funciona para brands con 10-12+ clusters geográficos; operaciones más pequeñas no tienen poder estadístico.

En 2026, GeoX está nativamente integrado con Google Cloud BigQuery — puedes extraer GA4 + datos de producto directamente hacia el pipeline de test. Setup toma 2 semanas, test duration 4-6 semanas, ciclo total 6-8 semanas.

## Cuál Usar Cuándo

Aplica este árbol de decisión:

| Situación | Herramienta | Por Qué |
|---|---|---|
| 2+ años de datos, optimización estratégica de presupuesto | Robyn (MMM) | Response curves + detección de saturación a largo plazo |
| Test de nuevo formato creativo (ej. Reels vs. Feed) | Meta Conversion Lift | Rápido, específico del formato, 2-4 semanas |
| Sospecha de halo cross-channel (ej. YouTube + Search synergy) | Geo experiment | Captura spillover entre canales |
| Comienzas desde cero | Lift primero, MMM después | Optimiza tácticamente con Lift los primeros 6 meses, luego estabiliza con MMM |

Para Robyn el setup mínimo es: entorno Python/R, 120+ semanas de datos de gasto + ventas, un nodo donde funcione Prophet (2-4 cores son suficientes). El output puede refrescarse semanalmente pero el modelo se debe reconstruir mensualmente.

Para Meta Lift: campaña activa en Business Manager, 200k+ reach semanal, conversión enviada vía CAPI. La aprobación de Lift toma 3-5 días hábiles.

Para GeoX: 10+ clusters geográficos, integración BigQuery, GA4 + datos transaccionales. Google lanzó esta herramienta en beta pública en Q4 2025; en 2026 está en producción completa.

## Pitfalls Prácticos de Robyn

Cuando configures Robyn, el primer problema es hyperparameter tuning. El framework prueba 100.000 combinaciones de modelos por defecto — en una máquina de 8 cores esto toma 6-8 horas. Si corres esto semanalmente el costo es tolerable, pero si necesitas refresh diario, requieres un cluster Spark distribuido.

Segundo pitfall: la ventana de adstock. Robyn usa por defecto una ventana de 13 semanas — el impacto del gasto de una semana decae durante 13 semanas. Pero para fast fashion (ciclo de vida de producto 4-6 semanas), 13 semanas es absurdo. Debes override este parámetro manualmente según tu categoría, sino el modelo sobreestima canales con tail largo como TV.

Tercer pitfall: estacionalidad. Prophet automatiza la descomposición de Fourier pero en Turquía hay holidays flotantes (Ramadán, Eid, Black Friday). Debes agregarlos manualmente al dataframe `holidays`. En 2026, Robyn v4.1 soporta import de formato iCal — puedes extraer directamente desde Google Calendar.

## Qué Confidence para Qué Decisión

El output de MMM es probabilístico — cada canal tiene un coeficiente medio y un intervalo de confianza del 95%. Por ejemplo, si Meta ROAS = 3.2 ± 0.7, el valor real está entre 2.5 y 3.9 con 95% de probabilidad. Si el rango es amplio (±1.2), ese coeficiente es inestable — necesitas más datos.

La confianza de Lift es fija: Meta usa un threshold del 90%. Si el resultado dice "no estadísticamente significativo", o el sample size fue pequeño o no hay lift real. Con 200k reach capturas lift del 10%, pero para detectar lift del 5% necesitas 500k+ reach.

La confianza de geo experiment depende de qué tan bien fitea el synthetic control: si el MAPE (mean absolute percentage error) pre-tratamiento es <5%, es confiable; >10% sugiere revisar tus clusters geográficos.

## Última Nota: Embeber el Árbol de Decisión en el Workflow

En 2026, los equipos de [marketing de rendimiento](https://www.roibase.com.tr/es/ppc) exitosos usan MMM + incrementality en el mismo pipeline de decisiones: Robyn corre la primera semana de cada mes y actualiza la asignación de presupuesto trimestral. Los Lift tests se ejecutan con lanzamientos de nuevo creative/format y dan veredicto táctico en 2-4 semanas. Los geo experiments se usan 2-3 veces al año, como validación antes de cambios mayores de mix de canales (ej. antes de aumentar 50% el presupuesto en TikTok).

Para armar este setup necesitas tres flows independientes en tu data pipeline: (1) datos diarios de transacciones + gasto fluyen a BigQuery, (2) Robyn consume esos datos semanalmente, (3) resultados de Lift y GeoX se importan manualmente al dashboard. Todo converge en un solo dashboard Looker que le reportas al CMO: "Meta ROAS fue 3.4 el mes pasado (MMM), el nuevo formato Reels generó 12% de lift (Lift), el test geo de TikTok falló (GeoX)".
