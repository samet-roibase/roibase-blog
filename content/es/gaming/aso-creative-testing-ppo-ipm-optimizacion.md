---
title: "ASO Creative Testing: PPO +%32 IPM en 6 Semanas"
description: "Custom Product Pages y Play Experiments para testear creativos con confianza estadística. Cómo capturamos +%32 de aumento en IPM en un ciclo de 6 semanas."
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, ipm-optimization]
readingTime: 8
author: Roibase
---

El tráfico orgánico en App Store sigue siendo el canal de CAC más bajo — pero en 2026, ese tráfico ya no está expuesto a un solo creativo. Las Custom Product Pages (CPP) de Apple y Play Experiments de Google Play trasladaron la disciplina de testing de creativos que llevamos años aplicando en campañas de UA a la página de la store. Resultado: con la arquitectura de test correcta, puedes aumentar la conversión impression-to-product-page (IPM) un %32 en 6 semanas. Este artículo explica cómo se construyó esa arquitectura.

## Qué es una Custom Product Page y por Qué Ahora es Crítica

Apple lanzó las Custom Product Pages en 2021 — páginas de store paralelas que sirven variaciones creativas diferentes para la misma app. Google Play Experiments ha permitido testear el store listing desde 2019. La lógica común de ambas plataformas: un solo "creativo universal" ya no funciona porque los segmentos de usuarios reaccionan diferente ante diferentes mensajes.

La diferencia de las CPP respecto a las campañas de UA es esta: si testeas un creativo en UA, ves CPI y D1 retention, pero no puedes medir el primer paso del user journey — la pérdida entre click e install es un punto ciego. Las Custom Product Pages cierran ese vacío. Sirves una variante de CPP en Apple Search Ads, la cantidad de impresiones y vistas de product page entre ellas (IPM) te muestran qué mensaje atrae, y el número de installs qué mensaje genera compromiso.

En 2026 esto es crítico porque después de iOS 14.5, con la pérdida de IDFA, el tráfico orgánico de ASO volvió a ser el canal más controlable. En paid UA, el targeting se estrechó y los CPMs subieron — pero en ASO, un aumento de IPM mediante creative testing mejora directamente el ratio LTV/CAC.

## Cómo Lograr Confianza Estadística con Play Experiments

Google Play Experiments te permite hacer A/B tests de elementos del store listing (icono, screenshots, vídeo, feature graphic). Los resultados se presentan en Google Play Console con intervalos de confianza — %90, %95, %99. La mayoría de equipos ven "una palomita verde" y lanzan la variante ganadora en producción. Enfoque incorrecto.

La confianza estadística depende del tamaño de muestra y del tamaño del efecto. Si ves una diferencia del %5 en IPM con 10.000 impresiones, esa diferencia puede ser ruido. Si esa misma diferencia se mantiene en 100.000 impresiones, la confianza supera el %95. En nuestro ciclo de 6 semanas aplicamos una regla: **mínimo 50.000 impresiones por variante + %95 de confianza + mínimo 7 días de test**. Ninguna variante se lanzaba sin cumplir estos 3 criterios.

Los elementos testeables en Play Experiments son limitados — orden de screenshots, icono, descripción corta. Pero esa limitación aporta claridad: en cada test aíslas UNA sola variable. Por ejemplo, si testeas "¿gameplay o artwork de personaje en el primer screenshot?" el icono y la descripción permanecen fijos. Si haces un test multivariante, no puedes aislar qué está impactando.

### Ejemplo de Arquitectura de Test

```
Test #1 — Batalla de iconos
- Control: icono actual (close-up de personaje tono azul)
- Variante A: artwork del entorno tono naranja
- Variante B: combinación personaje + logo
- Métrica: impresión → vista de product page (IPM)
- Duración: 14 días, 120K impresiones

Test #2 — Orden de screenshots
- Control: [gameplay, UI, personaje, feature]
- Variante A: [personaje, gameplay, feature, UI]
- Métrica: vista de product page → install (conversion rate)
- Duración: 21 días, 80K impresiones
```

En el primer test importa el IPM, en el segundo la conversión. Si testeas ambos simultáneamente pierdes la causalidad.

## La Anatomía del +%32 de Aumento en IPM en 6 Semanas

En nuestro proyecto gaming, el objetivo era simple: aumentar el IPM orgánico en Google Play. El baseline era %12.4 (1.240 vistas de product page por cada 10.000 impresiones). Ejecutamos 3 variantes de CPP en Apple Search Ads y 2 Experiments en Play. Después de 6 semanas, la combinación ganadora llevó el IPM a %16.3 — aumento del %32.

**Semanas 1-2:** Test de icono. El icono control era un close-up de personaje. La variante A, artwork del entorno; la variante B, personaje + logo. Después de 14 días, B ganó (%13.8 IPM vs control %12.4), confianza %97. Insight: los usuarios sienten confianza con el reconocimiento de logo, el arte puro se siente frío.

**Semanas 3-4:** Test de orden de screenshots. Control [gameplay, UI, personaje], variante A [personaje, gameplay, feature]. Mostrar el personaje en el primer screenshot elevó el IPM a %15.1. Confianza %96, 21 días, 94K impresiones. Insight: el segmento casual RPG está orientado al personaje, busca un hook emocional antes que gameplay.

**Semanas 5-6:** Segmentación de CPP — en Apple Search Ads, CPPs diferentes para grupos de keywords diferentes. Para el keyword "RPG games", CPP orientada al personaje; para "strategy games", orientada a gameplay. Esta segmentación elevó el IPM a %16.3. En el store general, la combinación ganadora — icono B + primer screenshot con personaje — se convirtió en el default.

En total: 6 semanas, 4 tests paralelos, 280K impresiones. Ningún test se cerró por debajo del %90 de confianza. Resultado: IPM +%32, número de installs en el mismo volumen de impresiones +%28.

## Tradeoff: Aumento de IPM vs Calidad de Install

El aumento de IPM no siempre es positivo neto. Un creativo que atrae puede generar installs, pero si atrae al usuario equivocado, la D1 retention cae. Para controlarlo, en cada variante también monitoreamos **D1 retention** y **D7 cohort LTV**.

El screenshot orientado al personaje había elevado el IPM a %15.1, pero la D1 retention cayó de %42 a %39 — 3 puntos. Al calcular el LTV: el aumento de IPM elevó los installs %18, pero la caída de retention bajó el LTV %7. El impacto neto fue positivo (+%18 installs > -%7 LTV), pero si la retention hubiera caído por debajo del %35, habríamos rechazado la variante.

Tabla de decisión de tradeoff:

| Variante | IPM Δ | Install Δ | D1 Retention Δ | D7 LTV Δ | Decisión |
|---------|-------|-----------|----------------|----------|----------|
| Icono B | +11% | +9% | -1 punto | +2% | Aceptar |
| Screenshot A | +22% | +18% | -3 puntos | -7% | Aceptar (neto positivo) |
| Screenshot C (testado, no mostrado aquí) | +30% | +25% | -8 puntos | -18% | Rechazar |

Screenshot C mostraba un personaje de estilo anime exagerado. El IPM se disparó pero generó expectativas incorrectas, la retention colapsó. El test fue válido pero el resultado "no ganó" — ese es la perspectiva de LTV más allá de la confianza estadística.

## Ahora Qué: Montar Tus Propios Tests

El testing de creativos en ASO ya no es opcional, es obligatorio. Pero el setup no es aleatorio — requiere hipótesis, tamaño de muestra, y control de retention. Si aún lanzas a iOS y Android con una sola página de store, probablemente estés perdiendo %15-20 en IPM.

Primer paso: mide tu IPM actual. En Apple Search Ads Console tienes impresiones y vistas de product page; en Google Play Console Analytics tienes funnels de adquisición del store listing. Establece el baseline. Segundo paso: monta un test de variable única — icono o primer screenshot. Tercer paso: espera 50K impresiones + %95 de confianza + mínimo 7 días, y luego verifica con datos de retention. Cuarto paso: lanza la variante ganadora a producción, formula una nueva hipótesis.

En el proceso de [App Store Optimization](https://www.roibase.com.tr/es/aso), el testing de creativos es la capa con retorno más rápido — porque no requiere cambios de código o desarrollo de features, solo cambio de assets. Si ya ejecutas una campaña de UA, trasladar esta disciplina a ASO es un trabajo de 6-8 semanas y el resultado es mensurable.