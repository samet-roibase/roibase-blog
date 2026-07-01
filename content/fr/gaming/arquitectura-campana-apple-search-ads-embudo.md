---
title: "Apple Search Ads: Estructurar la Arquitectura de Campaña como un Embudo"
description: "Discovery, competitor, brand, broad match — gestionar el flujo de presupuesto con lógica de embudo. Optimización install-to-LTV en mercados Tier-1."
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, arquitectura-campana-asa, adquisicion-usuarios-mobile, optimizacion-embudo, crecimiento-gaming]
readingTime: 9
author: Roibase
---

Si estás gestionando campañas de Apple Search Ads solo con broad match en un nivel, estás desperdiciando el 40% de tu presupuesto en los usuarios equivocados. En 2026, la capacidad de aprendizaje algorítmico de ASA aumentó, pero sin lógica de embudo, la máquina te enseña las señales incorrectas. Discovery genera installs más baratos, brand produce D7 LTV más alto — pero si los mezclas, pierdes ambos. Estructurar la arquitectura de campaña como capas de embudo no es solo eficiencia presupuestaria, es alimentar correctamente la señal de atribución.

## Capa Discovery: Funcionar como Motor de Exploración con Broad Match

La campaña de Discovery existe en ASA para usar la red amplia y encontrar nuevos segmentos de usuarios. Broad match, keyword genérico, término de categoría — alto volumen de installs, bajo IPM, pero aquí generas señal de aprendizaje. El algoritmo aún no sabe qué perfil se ajusta a tu juego, y tú tampoco puedes adivinarlo. El propósito de Discovery es identificar en las primeras 72 horas qué usuarios generan engagement.

La distribución presupuestaria en la capa de Discovery debe ser el 25-30% de tu gasto total en ASA. Si superas esto, el CPI se ve bajo pero el LTV no vuelve. Si estás por debajo, vuelves a los mismos usuarios sin alcanzar nuevos segmentos. Ejemplo: si tu presupuesto mensual de ASA es $50K, asigna $12-15K a Discovery. El objetivo de la campaña debe ser CPT (costo por tap), no CPI, porque en esta capa importa el volumen, no la calidad del tap.

Estrategia de keywords:

- Términos de categoría (ej. "puzzle game", "strategy rpg")
- Búsquedas de intención amplia ("free games", "offline games")
- Nombres de juegos competidores (con broad match, también se activan juegos relacionados)

En campañas de Discovery, mientras más reduces la lista de palabras clave negativas, más reduces el área de aprendizaje. En las primeras 2 semanas, trabaja sin añadir negativos; a partir de la semana 3, bloquea search terms donde D1 retention está por debajo del 15%.

## Capa Competitor: Robar Usuarios Competidores con Exact Match

La campaña de Competitor apunta al tráfico de mayor intención de ASA. Cuando un usuario escribe el nombre de un juego competidor, tiene clara intención de descargar — tu trabajo es ofrecer una alternativa. Con broad match, capturas búsquedas "similares" al nombre competidor, pero la capa Competitor debe funcionar con exact match porque el control presupuestario es crítico. Un usuario buscando el nombre exacto del juego competidor quiere descargarlo, o busca alternativas, o ya lo juega y quiere algo nuevo.

Distribución presupuestaria entre el 20-25%. Conforme aumentas el número de competidores, este porcentaje puede crecer, pero no targets todos por igual. El competidor Tier-1 (líder del mercado, mecánicas cercanas a la tuya) no trabaja con el mismo CPI que Tier-2 (mecánicas distintas, pero mismo perfil de usuario). Para Tier-1, el multiplicador de bid debe ser 120-150%, para Tier-2 entre 80-100%.

En campañas Competitor, la diferencia creativa es decisiva. El usuario conoce el juego competidor, tu Custom Product Page debe compararse sin mencionar explícitamente el nombre. Ejemplo: si el juego competidor usa combate por turnos, tu CPP destaca "PvP en tiempo real". La [optimización en App Store](https://www.roibase.com.tr/fr/aso) con variantes de CPP específicas para esta capa aumenta IPM entre 18-25%.

La señal negativa es crítica: no intentes reatrapar usuarios que descargaron el juego competidor y lo borraron buscando nuevamente ese nombre. ASA no tiene señal "previous downloader", pero si D1 retention está por debajo del 10%, ese segmento de usuario ya se quemó.

## Capa Brand: Proteger Usuario Existente con Exact Match

La campaña Brand es la línea defensiva en ASA. El usuario que busca el nombre de tu juego ya te conoce — pero tus competidores también pujan por tu brand term. Sin campaña Brand, el anuncio competidor aparece sobre el tuyo y pierdes 8-12% de usuarios. Esta capa entrega el CPI más bajo pero tráfico pequeño; sin embargo, el LTV es el más alto porque el usuario llega con intención consciente.

Distribución presupuestaria 10-15% — pequeño pero ininterrumpido. Si pausas una campaña Brand, un competidor lo detecta en 48 horas y aumenta su bid. La estrategia de keywords es solo el nombre del juego y variantes:

| Tipo de keyword | Ejemplo | Tipo de match |
|---|---|---|
| Nombre del juego | "Your Game Name" | Exact |
| Abreviatura | "YGN" | Exact |
| Variantes typo | "Your Gam Name" | Broad (solo typo) |

En la campaña Brand, no hagas test de creativos. El usuario ya conoce tu juego; en el visual, la consistencia importa — icono app, logo del juego, personaje conocido. Si usas variante de CPP, lo confundes.

La estrategia de bid puede ser baja porque Apple ya te da ventaja en brand terms. Aunque un competidor puje 150% en tu brand term, tu bid de 100% aparece arriba. Pero no bajes el bid a cero; necesitas mínimo $0.50 de bid para evitar que el competidor empuje la lista orgánica.

## Modo Broad Match: Uso Diferente en Cada Capa

Broad match en ASA no es un único setting, sirve propósitos distintos en cada capa. En Discovery, broad match es herramienta de exploración — máximo reach, mínimos negativos. En Competitor, broad match es riesgoso porque activa búsquedas irrelevantes y dispersa presupuesto. En Brand, broad match solo para variantes typo.

La capacidad de aprendizaje de broad match aumentó en 2026, pero requiere mecanismo de control. El algoritmo de ASA aprende qué search term genera conversión, pero no puede saber qué perfil de usuario genera D7 LTV. Por eso campañas broad match necesitan análisis en ciclos de 14 días:

1. **Días 1-7:** Trabaja sin añadir negativos, recopila reporte de search terms
2. **Días 8-14:** Bloquea términos donde D1 retention <15%, aumenta bids 10%
3. **Días 15-21:** Revisa datos de D7 LTV, actualiza lista negativa

En campañas broad match, el multiplicador de bid debe ser 80-90% para Discovery, 100-120% para Competitor. Mientras el algoritmo busca "búsquedas similares", también usa la señal de bid; un bid bajo alarga el período de aprendizaje.

## Gestionar Flujo Presupuestario como Embudo

Tras estructurar las capas de campaña, el flujo presupuestario debe funcionar como embudo. Discovery genera alto volumen de installs pero LTV incierto; Competitor genera volumen medio pero LTV predecible; Brand genera bajo volumen pero LTV alto. La distribución no es fija, se ajusta dinámicamente según reporte de LTV semanal:

**Semana 1 (fase de exploración):**
- Discovery 35%
- Competitor 25%
- Brand 15%
- Reserva 25% (espera para tests)

**Semanas 2-4 (fase de aprendizaje):**
- Discovery 30% (la proporción baja conforme crece lista negativa)
- Competitor 30% (aumenta para competidores ganadores)
- Brand 15%
- Reserva 25%

**Semana 5+ (fase de optimización):**
- Discovery 25%
- Competitor 35% (scale en competidores con LTV positivo)
- Brand 15%
- Reserva 25% (nuevos tests o push estacional)

Nunca distribuyas presupuesto de reserva a campañas fijas. Guarda para oportunidades: event estacional, lanzamiento de feature nuevo, actualización mayor de juego competidor. En ASA, un aumento presupuestario abrupto corta el proceso de aprendizaje del algoritmo; fluir gradualmente desde reserva es más eficiente.

## Capa de Medición en Arquitectura de Embudo

Una vez estructuradas las capas de campaña, la señal de atribución no debe romperse. ASA funciona nativamente con SKAdNetwork, pero para métricas post-install como D7 LTV necesitas integración MMP. Herramientas como AppsFlyer, Adjust o Singular vinculan el ID de campaña ASA al análisis de cohortes. Cada capa — Discovery, Competitor, Brand — debe tener su propio campaign ID para segmentar datos de LTV por capa.

Sin infraestructura de medición, la arquitectura de embudo es solo distribución presupuestaria, no optimización. Cada capa tiene su métrica de éxito:

| Capa | Métrica primaria | Métrica secundaria | Señal negativa |
|---|---|---|---|
| Discovery | IPM (installs por mil) | D1 retention | CPI >$3 y D1 <15% |
| Competitor | D7 LTV | CPIn | D7 LTV <$2 |
| Brand | CR (conversion rate) | D30 LTV | CPIn >$1.5 |

Las métricas se analizan en ciclos de 14 días, no diarios, porque el algoritmo ASA completa aprendizaje en 10-14 días. Si optimizas diariamente, rompes la señal.

## Testear y Escalar la Arquitectura de Campaña

En configuración inicial, comienza con 3 campañas (Discovery, Competitor, Brand). Si tu presupuesto está bajo $10K, usa múltiples ad groups en una campaña, pero esta estructura empaña la capa de LTV. El presupuesto inicial ideal es $15K mensuales — en este nivel, cada capa recibe volumen suficiente y el aprendizaje acelera.

Durante scale, profundiza las capas existentes en lugar de añadir nuevas. Ejemplo: divide Competitor en Tier-1 y Tier-2, o Discovery por geografía (mercados Tier-1 vs emerging). Cada nueva división reinicia el período de aprendizaje, así que decide escalar solo cuando LTV se estabilice.

Durante tests, no crees campañas duplicadas. En ASA, una campaña duplicada hace que el algoritmo compita contra tu propio anuncio. En su lugar, usa Creative Sets para testear variantes de CPP, y aplica la ganadora a todas las campañas. Con el [Programa de Publisher Premium](https://www.roibase.com.tr/fr/dijitalpazarlama), puedes combinar resultados de test de creativos en ASA con otros canales (UAC, Meta) para acelerar iteración.

Una vez establecida la arquitectura de embudo, el mantenimiento es bajo pero continuo. Reporte semanal de search terms, reporte de LTV cada 14 días, análisis de cohortes mensual — no saltes estos ciclos o la campaña no se optimiza. El algoritmo de ASA te envía señales, tú devuelves señales correctas. Descubre perfiles en Discovery, traslada aprendizaje a Competitor, refuerza LTV en Brand. La arquitectura de campaña funciona como ciclo dinámico de aprendizaje, no como lista estática.