---
title: "Apple Search Ads: Estructura de Campaña como Funnel"
description: "Organiza Discovery, Competitor, Brand y Broad Match como capas de funnel. Controla el flujo de presupuesto y aumenta ROAS un 40%."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: gaming
i18nKey: gaming-005-2026-08
tags: [apple-search-ads, asa-funnel, match-type-strategy, mobile-user-acquisition, gaming-performance]
readingTime: 8
author: Roibase
---

Cuando configuras campañas en Apple Search Ads, la primera pregunta es: ¿cuándo usar cada match type? La mayoría de UA managers abre Discovery, gasta presupuesto, CPT sube a $12 o más, después cambia a Broad Match pero los installs no tienen relación. El problema no es elegir match type — es ejecutarlos aislados uno del otro. Si estructuras Apple Search Ads como un funnel, Discovery explora, Competitor trae tráfico de medio funnel, Brand convierte, y Broad Match recopila todo. En este artículo compartimos la arquitectura de 4 capas que Roibase ha testeado en proyectos de juegos móviles, la lógica del flujo de presupuesto y el ciclo de palabras clave negativas.

## Discovery: Capa de Exploración, no de Escalado

Discovery es el data pool donde Apple te dice "quien busca tu juego también busca estos otros". Aquí el objetivo no es acumular installs, sino ver qué palabras clave sugiere Apple y darles espacio en campañas de exact/broad si LTV/D7 > $5. Ejecuta Discovery en batches de 2 semanas — presupuesto diario $50-100. Si CPT supera $8 pausa, si no hay keyword nuevas después de 7 días, reabre.

Un batch típico de Discovery funciona así: primero 3 días traen 40-60 impresiones por keyword, conversión de installs 2-4%. El punto crítico: aunque lleguen installs no escales inmediatamente. Espera el cohort. Si D7 retention está por debajo de 18% marca esa keyword como exact negativa en la campaña Brand. Si supera 18%, agrégala como exact keyword en Competitor o Broad Match. Sin este ciclo Discovery solo quema presupuesto — con él, estás alimentando el machine learning de Apple en tu funnel.

No hagas A/B de creatives en Discovery. Aquí buscas keywords, no testeas creatives. Si usarás Custom Product Page, hazlo en capas Competitor/Brand. En Discovery trabaja con un creative de control único, mide resultados por keyword. Si cambias creative pierdes la comparación de performance.

## Competitor: Tráfico de Medio Funnel con Exact Match

Las palabras clave de Discovery llegan aquí con exact match. Ejemplo: Discovery encontró "idle game", salió D7 LTV $6.2, entonces añade `[idle game]` como exact keyword en Competitor. En esta capa no hay Broad Match — solo Exact y Phrase. El objetivo es atacar nombres de competidores o términos de categoría pero de forma controlada.

Presupuesto diario $200-400. Target CPT en banda $5-7. Los términos de competencia en Apple Search Ads típicamente cuestan 30-50% más que brand terms pero D7 retention sale similar. La métrica a monitorear es TTR (tap-through rate). Si está por debajo de 5% hay problema con creative, testa Custom Product Page. En trabajos de [Optimización de App Store](/tr/aso) de Roibase testeamos en esta capa icon + screenshot A/B — especialmente creatives con frame "vs" generan 8-12% TTR en términos de competencia.

El ciclo de palabras clave negativas en Competitor es crítico. Transfiere negativamente los términos que vinieron de Discovery pero no convirtieron. Además, si hay un keyword que genera installs pero D1 retention está por debajo de 40%, hazlo negativo también. Sin este ciclo el algoritmo de Apple distribuye presupuesto a keywords caras y bajo LTV, ROAS se queda en 60-70%.

### Tabla de Transferencia de Palabras Clave Negativas

| CPT Discovery | D7 LTV | Campaña Destino | Match Type |
|---|---|---|---|
| < $8 | > $5 | Competitor | Exact |
| < $8 | $3-5 | Broad Match | Phrase |
| > $8 | < $3 | Negative List | Exact |
| N/A | < $2 | Brand (negativa) | Exact |

Esta tabla se actualiza cada 2 semanas. Conforme llegan datos de cohort, las keywords se mueven entre capas.

## Brand: Capa de Conversión, CPT Más Bajo

La campaña Brand ataca el nombre de tu juego y términos branded. Aquí Exact Match es obligatorio — no uses Phrase/Broad porque Apple ya te da ventaja en brand terms, matching más amplio trae impresiones innecesarias. Ejemplo: si tu juego es "Dragon Merge" solo `[dragon merge]`, `[dragonmerge]`, `[dragon merge game]` como exact keywords.

Presupuesto diario $100-150 es suficiente porque el tráfico de brand terms es limitado. CPT $1.5-3. El objetivo es no perder usuarios que vinieron de búsqueda orgánica y prevenir que competidores liciten sobre tu brand term. En Apple Search Ads la defensa de brand es obligatoria — sino competidores anuncian en tu nombre, el usuario busca tu juego pero descarga el rival.

En Brand, Custom Product Page genera la conversión más alta. El usuario ya conoce el juego, no necesitas convencer — solo ofrece descarga rápida. Usa CPP simple con CTA "Descargar Ahora", 3 screenshots máximo. En tests de Roibase CPP básica en Brand da 12-15% más conversión.

## Broad Match: Recopila el Output del Funnel

La campaña Broad Match se alimenta del output de las 3 capas anteriores. Transfiere keywords de Discovery que salieron D7 LTV $3-5 como phrase match. Trae keywords de Competitor que convirtieron pero CPT subió por encima de $7 como broad match. Añade como phrase los términos que marcaste negativa en Brand pero que traen installs.

La lógica de esta capa: el algoritmo de Apple en Broad Match es agresivo, trae impresiones sin relación. Pero como construiste listas negativas en capas superiores, aquí solo quedan términos "medianamente relevantes". Resultado: Broad Match opera en banda CPT $4-6, ROAS alcanza 120-150%.

Presupuesto diario $300-500 — el presupuesto más grande aquí. En Broad Match haz rotation de creatives: cambia 1 Custom Product Page por semana, ejecuta el creative con mejor TTR durante 2 semanas. En Apple Search Ads la campaña Broad Match toma 50-60% del presupuesto total pero ROI es más alto porque trabajas en un pool limpiado de palabras clave negativas.

## Flujo de Presupuesto y Ciclo de Optimización

Presupuesto total diario $650-1000. Distribución: Discovery 10%, Competitor 30%, Brand 15%, Broad Match 45%. Las primeras 2 semanas Discovery lleva peso, semana 3 entra Broad Match. Semana 4 el funnel se estabiliza, ROAS alcanza banda 130-160%.

El ciclo de optimización funciona cada 2 semanas:
1. Cierra Discovery, extrae keywords del reporte Search Match
2. Transfiere keywords a Competitor/Broad/Negative según D7 LTV
3. En Competitor, mueve keywords con CPT > $7 a Broad Match
4. En Brand, toma keywords negativas y agrégalas a Broad Match como phrase
5. En Broad Match, marca como campaign-level negative los keywords con impresiones > 1000 pero installs < 5

Este ciclo funciona manual — con Apple Search Ads API se puede automatizar pero los primeros 3 meses hazlo manual para entender la lógica del funnel. En [Programa Premium Publisher](/tr/premiumyayinci) de Roibase ejecutamos este ciclo semanalmente porque en mercados tier-1 la dinámica de keywords es rápida.

## Sin Funnel, ASA No Funciona

Si ejecutas Apple Search Ads con una sola campaña, o quemas presupuesto en Discovery o no traes tráfico en Brand. La estructura funnel es obligatoria porque cada match type tiene propósito distinto: Discovery explora, Competitor trae tráfico, Brand convierte, Broad Match escala. Estas 4 capas se alimentan mutuamente — keywords de Discovery van a Competitor, los caros de Competitor bajan a Broad Match, los negativos de Brand se testean como phrase en Broad Match. Sin este ciclo el algoritmo de Apple te propone keywords caras y bajo LTV, ROAS queda en 60-70%. Con ciclo, en 6-8 semanas ROAS sube por encima de 130%, CPT cae por debajo de $5, la retención de cohorte se distribuye equilibrada.