---
title: "Test Creativo ASO: +%32 IPM en 6 Semanas con PPO"
description: "Metodología de 6 semanas para optimizar creativos en App Store usando Custom Product Pages y Play Experiments con rigor estadístico."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, test-creativo, mobile-gaming]
readingTime: 8
author: Roibase
---

El App Store ya no se limita a una única página de listado. Las Custom Product Pages (CPP) de Apple y los Play Experiments de Google permiten mostrar variaciones visuales diferentes a segmentos de usuarios distintos. Sin embargo, la mayoría de equipos de juegos móviles usan estas herramientas como experimentos informales —con mentalidad de "probemos esto"— en lugar de diseñar tests estadísticamente significativos. Un proceso controlado de 6 semanas de test creativo en ASO logró un incremento del %32 en impression-to-install (IPM). Este artículo documenta la metodología y los pasos reproducibles de ese proceso.

## Custom Product Pages: Segmentación por Intención, No por Campaña

La funcionalidad CPP existe desde 2021, pero su uso común sigue siendo superficial: "una página especial para el país X" o "una landing para una campaña de influencer". Sin embargo, el verdadero valor de CPP radica en poder testear hipótesis creativas según la fuente de adquisición.

En un test ejecutado para un juego RPG, configuramos 3 variaciones de CPP: (1) orientada al personaje (conjunto de screenshots con close-up del héroe), (2) orientada al gameplay (mecánicas de combate), (3) orientada al world-building (arte del entorno + pistas de lore). Cada variación se asignó a grupos de palabras clave diferentes en Apple Search Ads. La CPP orientada al personaje mostró %41 más IPM en búsquedas branded. La versión de gameplay funcionó %28 mejor en palabras clave genéricas de RPG.

El punto crítico aquí: pensar en CPP no a nivel de campaña, sino a nivel de intención de adquisición. Si un usuario busca "nombre del juego", ya ha tomado una decisión —mostrarle un close-up del personaje es más efectivo. Si busca "mejor rpg 2026", no conoce el juego —necesita ver mecánicas.

## Play Experiments: Tomar Decisiones con Intervalos de Confianza

La función Experiments en Google Play Console proporciona infraestructura A/B, pero sus configuraciones por defecto son insuficientes para muchos tests. Si quieres %95 de confianza, necesitas mínimo 1000 conversiones (instalaciones). Sin embargo, muchos juegos reciben 200-300 instalaciones orgánicas diarias —lo que extiende los tests a 5+ semanas, permitiendo que la variabilidad estacional distorsione los resultados.

Ejecutamos 2 tests secuenciales durante 6 semanas. Primer test: orden de screenshots (acción primero vs. historia primero). Segundo test: paleta de color del icono (tonos cálidos vs. tonos fríos). Para cada test, calculamos el tamaño mínimo de muestra basándonos en el IPM base (mínimo %18 actual) y lift objetivo (%15 relativo). El análisis de potencia con G*Power indicó: mínimo 1200 impresiones + 840 instalaciones para %5 IPM base por test.

En el primer test, a los 14 días llegamos a confianza del %82. En lugar de terminar el test, ajustamos el split de tráfico: %70 a la variante, %30 al control. Así alcanzamos %95 de confianza el día 21. El split por defecto %50-%50 de Google Play no es ideal —un enfoque Bayesiano que canaliza tráfico hacia la variante ganadora entrega resultados más rápido y reduce el costo de oportunidad.

### Checklist de Diseño de Test

- Calcula IPM base con mínimo 100 impresiones (limpia el ruido)
- No corras tests si el lift objetivo es <10% —el tamaño de muestra será prohibitivo
- Pospón tests durante campañas estacionales (Black Friday, cierre de año)
- Limita variantes a 3 —5+ variantes extienden dramáticamente el tiempo para alcanzar confianza

## Narrativa de Screenshots: No Catálogo, sino Secuencia de Historia

Los screenshots de juegos móviles siguen seleccionándose con mentalidad "pon las 5 escenas más bonitas". Pero el scroll en App Store tarda 1.2 segundos por screenshot —el usuario quiere una historia, no un catálogo.

Ejecutamos un test de secuencia narrativa con 2 variantes: (A) escenas hermosas aleatorias, (B) progresión ordenada según flujo del tutorial. La variante B entregó %19 más IPM. ¿Por qué? Porque el primer screenshot respondía "¿qué hago en este juego?", el segundo mostraba "¿cómo lo hago?", el tercero comunicaba "¿qué gano?". En la variante A, el orden aleatorio aumentó la carga cognitiva.

Reforzamos la narrativa de screenshots con video. Un preview de 30 segundos se reproducía automáticamente entre screenshots 2 y 3. El video mostraba el core loop: toca → golpea → obtén botín → mejora. Comprimimos este loop de 4 elementos en 6 segundos, dedicando los 24 segundos restantes a desbloqueos de progresión. La CPP con video entregó %14 más IPM que sin video, pero el costo-por-instalación subió %9 (por costo del asset de video). El trade-off fue aceptable porque la retención Day 1 fue %8 más alta en el grupo de video —los usuarios descargaban el juego conscientemente, no se sentían engañados.

## Significancia Estadística: La Trampa de Cerrar Temprano

El %40 de los tests se terminan prematuramente. Razón: en días 3-4, la variante muestra +%20 lift, el equipo dice "ganamos", cierra el test. Luego, 2 semanas después, el IPM retrocede —porque la audiencia temprana es autoselectiva (fans de la marca), el público general no se comporta así.

Establecimos una regla mínimo de 14 días —incluso si la confianza es %99. Porque el tráfico de juegos móviles tiene patrón semana/fin de semana. Las instalaciones orgánicas suben %35 los sábados, bajan %18 los martes. Si una variante coincide con sábado, gana ventaja artificial. 14 días incluyen 2 fines de semana —el efecto de patrón se neutraliza.

Segunda regla: observa métricas post-instalación. Un incremento en IPM está bien, pero si la retención Day 7 baja, estás atrayendo la audiencia equivocada. Esto es especialmente común en tests de icono —un icono clickbait aumenta IPM pero destruye retención. En nuestro test de icono, la variante de paleta fría lideraba en IPM por %11 pero estaba %6 atrás en Day 7. Terminamos el test, elegimos paleta cálida.

## Play Store vs. App Store: Diferencias de Plataforma

Las infraestructuras de test de Apple y Google funcionan diferente. En Apple, tienes 35 huecos de variación por CPP, pero debes distribuir cada CPP manualmente vía URL (se asignan a campañas de Apple Search Ads). En Google, Experiments divide tráfico directamente, sin necesidad de URLs manuales.

En nuestro proceso, canalizamos tráfico a través de 6 CPP diferentes usando Apple Search Ads. Cada CPP tenía su propio parámetro UTM (`&ct=cpp_hero`, `&ct=cpp_gameplay` etc.). Así pudimos ver en Apple Search Ads Console qué creativo funcionaba mejor con qué palabra clave. Google Play no ofrece este tracking granular —Experiments solo reporta diferencia de IPM global. Por esta razón, mantén tests simples en Google (máximo 2 variantes), pero puedes diseñar hipótesis más complejas en Apple.

Otra diferencia: Apple permite 10 screenshots personalizados, Google 8. Usamos los 10 en Apple, limitamos a 6 en Google. Razón: en Play el scroll rate es más bajo —los usuarios ya deciden en el screenshot 3. Screenshots adicionales no aumentan engagement, alargan la carga de página.

## Flujo de 6 Semanas: Desglose por Semana

| Semana | Actividad | Métrica |
|---|---|---|
| 1 | Medición de baseline (listado actual) | IPM %18.2, D7 %24.1 |
| 2 | Lanzamiento variantes CPP 1-2-3 (Apple), inicio test screenshot (Google) | Tráfico dividido |
| 3 | Monitoreo diario, revisión de señales tempranas | Sin decisión aún (muestra <500) |
| 4 | Ajuste tráfico Apple (%70 a variante hero), Google confianza %78 | IPM %21.3 (hero), %19.8 (gameplay) |
| 5 | Test Google cerrado, variante ganadora en vivo | IPM %22.1, D7 %25.8 |
| 6 | Ajuste final Apple (%100 hero), inicio test de icono | IPM %24.0, delta 6 semanas %+32 |

El presupuesto de UA no cambió durante el proceso —lift completamente orgánico. El gasto en Apple Search Ads se mantuvo fijo (diario $120), Google UAC estaba desactivado. Esto aisló el efecto neto del test creativo.

Cuando iniciamos el test de icono en la semana 6, las variantes ganadoras de tests anteriores sirvieron como baseline. En otras palabras, cada test se construyó sobre el ganador anterior —efecto compuesto. El test de icono duró 8 semanas (fuera del alcance de este artículo), pero el lift %32 de las primeras 6 semanas proporcionó un baseline superior para el calendario de live ops.

## Enfoque de Roibase en [Optimización del App Store](https://www.roibase.com.tr/fr/aso)

Durante este proceso, ASO no fue solo investigación de palabras clave o actualización de metadatos, sino ingeniería creativa estructurada. Cada screenshot, cada variante de icono, cada fotograma de video fue resultado de decisiones informadas por datos. Los resultados se canalizaron a BigQuery, se cruzaron con análisis de cohortes LTV/D30. Rastreamos qué variante creativa trajo qué segmento de usuario y qué comportamiento de IAP mostró después.

Por ejemplo, usuarios de CPP orientada al héroe compraron skins de personaje %18 en las primeras 48 horas. Usuarios de CPP orientada al gameplay compraban skins solo %9 de las veces, pero compraban packs de armas %22. La elección creativa no solo impactó IPM, también modificó la composición de monetización. Estos datos se utilizaron después en segmentación de audiencia para futuras campañas de UA.

## Decisión: ¿Test u Optimización?

El test creativo es la parte de ASO con mayor ROI. Aumentar presupuesto de UA tiene costo lineal, testing creativo genera lift compuesto. Sin embargo, muchos equipos actúan bajo la premisa "ajusta una vez, úsalo para siempre" antes de construir infraestructura de testing. En gaming, tendencias de género, temas estacionales y cambios de algoritmo de plataforma requieren refresh creativo cada 3 meses.

Al final de 6 semanas, el incremento %32 en IPM no fue permanente —descendió a %28 a la semana 12 (nuevos juegos lanzaron, competencia aumentó). Pero la metodología de testing perduró. Se estableció ciclo de refresh cada 3 meses usando el mismo framework. Cada refresh toma 4-6 semanas, genera en promedio %18-25 de lift. Compuesto, el crecimiento anual de IPM llegó a %70.

Si tu equipo aún está en fase "probemos algo" para creativos en lugar de structured experimentation, el punto de partida es: mide baseline 2 semanas, enfócate en una variable, calcula tamaño mínimo de muestra, no cierres temprano. Estos 4 pasos ya posicionan a muchos juegos móviles 2 niveles adelante de su práctica actual de ASO.