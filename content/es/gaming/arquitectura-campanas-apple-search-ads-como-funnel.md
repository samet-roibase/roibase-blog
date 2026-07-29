---
title: "Apple Search Ads: Estructurar la Arquitectura de Campañas como Funnel"
description: "Discovery, competidor, marca, broad match — enfoque ingenieril para estructurar la arquitectura de campañas en Apple Search Ads como funnel y optimizar el flujo de presupuesto."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-funnel, mobile-growth, app-campaigns, aso]
readingTime: 9
author: Roibase
---

Operar en Apple Search Ads desde un único tipo de campaña disuelve los distintos estadios del viaje del usuario en el mismo pool presupuestario. El usuario en modo Discovery y el que realiza una búsqueda de marca tienen costos, intenciones y dinámicas de conversión completamente diferentes. Estructurar la arquitectura de campañas como funnel introduce disciplina presupuestaria a cada etapa y permite leer métricas post-install (D7 retention, LTV) según el tipo de campaña. En este artículo desglosamos la arquitectura de Apple Search Ads en capas de discovery, competidor, marca y broad match, mostrando cómo gestionar el flujo presupuestario en cada una.

## Qué pregunta formula el usuario en modo Discovery

Las campañas Discovery son el mecanismo de expansión automática de Search Ads — el algoritmo de Apple expone tu aplicación a cientos de búsquedas basadas en categoría, comportamiento de usuario y semantic matching. En este modo, el usuario no busca una aplicación específica; lleva una necesidad amplia como "juego tower defense". El volumen de impresiones es alto, la tasa de clics baja, y el CPA relativamente económico, pero la D7 retention ronda el 15-20%. La función de Discovery no es brand awareness sino probar un segmento amplio con intención potencial.

En la configuración de campaña no puedes cerrar Search Match y crear un pool de discovery completamente controlado — Apple lo mantiene abierto por defecto. Tu estrategia debe aislar el tráfico de discovery en una campaña separada y gestionar la estrategia de puja desde impression share objetivo, no desde CPA target. Si en Discovery logras 60% impression share con 500 instales diarios y D7 retention del 18%, necesitas endurecerle el flujo a ese usuario con secuencias de push notification + onboarding in-app en los primeros 7 días. El tráfico de Discovery es la cúspide del funnel — aquí ejecutas hypothesis testing, no acquisition.

La disciplina presupuestaria funciona así: destina 25-30% del presupuesto total de ASA a la campaña Discovery, pero fija el CPA cap en 2x el de la campaña de marca. El costo por install desde Discovery puede ser 2x más caro que el tráfico branded, pero dado que el LTV es bajo, esa diferencia no es aceptable — si el CPA de Discovery sube a 2.5x el branded, debes pausar la campaña o reducir agresivamente la puja.

### Integra el reporte de Search Match Keywords con análisis de cohortes

Exporta semanalmente el listado de Search Match keywords de la campaña Discovery y lee las métricas de D7 retention y ARPU de cada cluster de keywords (por ejemplo, "strategy game", "idle game") por separado en tu MMP (Adjust, AppsFlyer). Si un cluster entrega 25%+ retention, migra ese grupo de keywords a una campaña exact match. El Search Term Report que Apple proporciona no ofrece suficiente granularidad — debes construir tú mismo el mapeo keyword → install → D7 usando event tracking personalizado. Este proceso es manual pero una analítica de 1-2 horas mensuales puede redirigir 40% del presupuesto de Discovery a canales más eficientes.

## Comportamiento de puja en campañas de competidor y riesgo legal

En campañas de competidor apuntas a keywords de marca de aplicaciones rivales (por ejemplo, "clash of clans", "candy crush"). Apple permite este tráfico pero bloquea creatives que supongan infracción de trademark. La TTR del tráfico de competidor ronda 5-8% — el usuario que busca rival ve una alternativa y hace clic en 5-10% de los casos. La estrategia aquí no es pujas agresivas sino rotation de creative inteligente — si tu creative subraya la mejor versión de una feature del rival (por ejemplo, "progresión más rápida", "sin paywall"), la TTR puede subir a 12%.

La razón de mantener la campaña de competidor separada es el perfil de LTV diferente. El usuario que llega desde tráfico de competidor típicamente hace churn de su juego actual o busca alternativa — su D30 retention puede ser 8-10% superior al tráfico de discovery porque el interés en la categoría es cierto. Sin embargo, la conversión IAP en los primeros 3 días es baja — el usuario compara. Asignación presupuestaria: 20-25% del presupuesto total de ASA, con CPA cap en 1.5x el branded. Si el CPA de competidor resulta menor que el branded, significa que el brand equity de tu rival es inferior al tuyo — en ese caso puedes elevar el presupuesto de competidor a 35%.

Gestión del riesgo legal: según la política de trademark de Apple, puedes usar el trademark de otro como keyword pero no puedes mencionarlo en el creative. Si tu rival denuncia a Apple, la campaña puede ser suspendida. Para minimizar este riesgo, distribuye la campaña de competidor entre 10-15 aplicaciones keyword — enfocarse en un solo rival aumenta el riesgo de suspension. Abre un ad group separado por keyword de competidor y revisa semanalmente el Search Term Report, añadiendo a negativos los broad match variants que Apple añade automáticamente.

## Campaña de marca: CPA arbitrage como mecanismo defensivo

Tu campaña de marca apunta a tu nombre de aplicación y variantes (por ejemplo, "roibase game", "roi base"). En este tráfico el listing orgánico ya está en primer lugar pero los rivales pueden pujar en tu keyword de marca — si no puja también, el rival aparece primero y te roba instales. La TTR de la campaña de marca ronda 25-40% — el usuario te busca, el clic es seguro. El CPA es el más bajo, típicamente un tercio del de Discovery.

Asignación presupuestaria: destina 30-35% del presupuesto total a la campaña de marca pero el objetivo aquí no es minimizar CPA sino maximizar impression share. Si en tu keyword de marca la impression share está por debajo de 85%, tus rivales te están cortando tráfico. Sube la puja hasta alcanzar 95%+ impression share. Incluso si el CPA de marca es 0.50 dólares, es aceptable porque ese usuario de todos modos te encontraría orgánicamente — lo que pagas aquí es una prima de seguro contra bloqueo de tu rival.

Desactiva Search Match en la campaña de marca. La expansión automática de Apple convierte búsquedas branded en genéricas, aumentando el CPA. Usa solo exact match y close variants. Estructura el ad group sobre un único keyword: el nombre de tu aplicación. Todos los otros keywords genéricos migralos a discovery o broad match. El custom product page de tu campaña de marca debe enfocarse en onboarding directo — este usuario ya te conoce, no necesita narrativa creativa.

## Campaña Broad Match: sandbox para expansión controlada

La campaña Broad Match es una capa intermedia entre Discovery y Marca — seleccionas keywords específicos pero permites que Apple los expanda con broad matching. Por ejemplo, el keyword "tower defense" se expande a "best tower defense", "tower defense offline", "td games". La ventaja de este modo es expansión controlada — no es autopiloto como Discovery, estableces tu propio pool de keywords y le dices a Apple "busca alrededor de esto".

La razón de separar Broad Match de Discovery es control presupuestario. En Discovery Apple puede ir a cualquier lugar; en Broad Match tú trazas límites. Asignación presupuestaria: 15-20%. La estrategia: toma keywords con buen desempeño de Discovery y Competidor, migralos a Broad Match, pruébalos 2 semanas. Si el CPA de Broad Match es 20%+ más bajo que Discovery, migra ese keyword a exact match. Broad Match funciona aquí como capa de "staging" — área donde los keywords se prueban antes de pasar a control total.

La disciplina de negative keywords en Broad Match es crítica. Entre las expansiones de Apple hay búsquedas totalmente irrelevantes (por ejemplo, "tower defense" → "tower building game"). Revisa semanalmente el Search Term Report y añade a negativos los keywords con CTR por debajo de 1% o CPA que duplica tu objetivo. Este proceso es manual pero una rutina de 15 minutos semanales recupera 30% del presupuesto de Broad Match.

### Bid multiplier strategy para apretar el flujo del funnel

Apple Search Ads no ofrece demographic targeting pero sí device y location targeting. Construye una tabla de bid multipliers separada para cada tipo de campaña en tu funnel. Por ejemplo, en Discovery reduce la puja 40% en geos tier-2 (Brasil, India) porque el LTV del usuario de esas regiones es la mitad que tier-1. En la campaña de Marca mantén la puja completa incluso en tier-2 porque el usuario que te busca ya está calificado. En Broad Match, sube la puja 20% para usuarios de iPad — el time spent per session es 35% superior y la conversión IAP es 18% más alta (datos App Annie 2025).

Aplica dayparting según tipo de campaña. Las campañas Discovery y Broad Match mantenlas activas 09:00-23:00, cierra tráfico nocturno. La campaña de Marca mantenla 7/24 abierta. Si los rivales pujan en tu keyword de marca de noche, tú también debes estar en defensa. Si endurecerle la metadata con [App Store Optimization](https://www.roibase.com.tr/es/aso) y mejoras tu ranking orgánico, el costo de la campaña de Marca baja — ASO funciona aquí como muro defensivo.

## Gestionar el flujo presupuestario con atribución closed-loop

Después de estructurar el funnel, lee las métricas post-install en tu MMP (Mobile Measurement Partner) por separado para cada tipo de campaña. Si Discovery entrega D7 retention 18%, Competidor 26%, Marca 42%, tu distribución presupuestaria debe revisarse según esa métrica. Un modelo simple: distribuye tu presupuesto total según la ratio LTV/CPA. Si la ratio LTV/CPA de Marca es 4.2 y la de Discovery es 1.8, destina 2.3x más presupuesto a Marca.

Sin embargo, sin esperar 90 días para calcular LTV puedes proyectarlo usando D7 retention y D1 ARPU como leading indicators. Si un tipo de campaña entrega D7 retention superior a 30%, revisa al alza tu proyección de LTV en 3x. Para automatizar estos cálculos, conecta tu MMP a BigQuery y ejecuta análisis de cohortes diarios. Un modelo simple en Python — 15 líneas de código — te deja proyectar D90 LTV desde D1 y D7 con 82% de accuracy (validado en datos propios).

Disciplina de creative rotation por tipo de campaña: cambia creative cada 10 días en Discovery y Broad Match; mantén el mismo creative 30 días en Marca. En Discovery el usuario no te conoce, testear creative tiene sentido. En Marca el usuario ya decidió, el cambio de creative apenas impacta TTR 2-3%. En la campaña de Competidor, usa de benchmark la última mecánica de campaña del rival y actualiza tu creative en consecuencia — es un proceso ágil, requiere ciclo semanal.

Estructurar la arquitectura de Apple Search Ads como funnel te permite aislar y optimizar cada estadio. Escanea un segmento amplio en Discovery, migra keywords según desempeño a Broad Match y Exact Match, gestiona tráfico de competidor con disciplina presupuestaria separada, defiende tu marca de rivales. Cierra el flujo presupuestario con métricas post-install (D7, LTV) y lee el ROI real de cada tipo de campaña en tiempo real. Una arquitectura de ASA sin estructura de funnel disuelve usuarios con distinto nivel de intención en el mismo pool, dirigiendo presupuesto a segmentos de bajo LTV — aplicando esta estructura reduces esa fuga 30-40%.