---
title: "Apple Search Ads: Estructurar la Arquitectura de Campaña como Funnel"
description: "Guía estructural para organizar campañas de discovery, competitor, brand y broad match como arquitectura de funnel, optimizando el flujo de presupuesto."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, aso, mobile-growth, funnel-architecture, campaign-structure]
readingTime: 8
author: Roibase
---

Gestionar Apple Search Ads como tipos de campaña aislados en lugar de una arquitectura de funnel interconectada cambia las reglas del juego de desempeño. Discovery, competitor, brand y broad match, cuando se consideran de forma independiente, dejan la distribución presupuestaria al azar. Pero cuando los organizas como capas de funnel, cada tipo de campaña alimenta señales a la capa superior y obtiene calidad de la inferior. A mediados de 2026, la mayoría de los equipos de crecimiento móvil en juegos aún gestionan campañas de forma aislada y por eso pierden eficiencia de 30-40% en sus CPT. Este artículo explica cómo estructurar la arquitectura de campaña con lógica de funnel, cómo dirigir el flujo presupuestario según señales clave y por qué la integración con ASO es crítica.

## Lógica de Funnel: Cada Tipo de Campaña Ocupa Una Capa Diferente

Apple Search Ads tiene cuatro tipos fundamentales de campaña: discovery (pestaña Search), competitor (búsquedas de marcas rivales), brand (búsquedas de tu propia marca) y broad match (términos de categoría amplia). En lugar de verlos como silos desconectados, piénsalo así: discovery está en la cima, capturando usuarios sin conciencia de marca. Broad match en el medio, con señales de intención pero competencia alta. Competitor más estrecho, usuarios que buscan la marca rival y tienen perfil calificado. Brand en la base, usuarios que ya te conocen. Si inviertes esta jerarquía, la distribución presupuestaria se rompe. Por ejemplo, asignar 60% a brand genera ventas pero no expande el pool de usuarios. Lo opuesto, dar 70% a discovery baja el CPT pero la retención se derrumba porque el tráfico frío ingresa al funnel de conversión sin estar listo.

En lógica de funnel, cada capa envía señales a la anterior. Si un usuario que viene de discovery alcanza 12% de retención D7 o superior, escribes su perfil de segmento como lista de palabras clave negativas en broad match, haciendo que este sea más estrecho y enfocado. Si el IPM (installs per mille) en competitor está por debajo de 8%, ese perfil de usuario rival no se alinea con el tuyo, detén la campaña. Si el CPA en brand sube de repente 40%, tu clasificación de ASO bajó, no es un problema de campaña sino de metadata. Cuando gestionas campañas de forma aislada, estas señales se pierden.

El flujo presupuestario también se estructura con la misma lógica. Discovery comienza con 40-50% porque rellena el pool de usuarios. Después de 3-4 semanas, cuando el perfil de retención se estabiliza, cambias a 30% en broad match y discovery baja a 30%. Brand siempre se mantiene fijo en 15-20% porque los usuarios que ya conocen la marca son económicos pero el volumen es limitado. Competitor es opcional: en mercados tier-1 (EE.UU., Reino Unido) puedes asignar 10-15%, en mercados emergentes (LATAM, SEA) es innecesario porque la conciencia de marca es baja.

## Campaña Discovery: Laboratorio de Experiencia de Tráfico Frío

Las campañas discovery aparecen en la pestaña Search. Cuando el usuario abre el juego, aparecen sugerencias "También te podría gustar". La señal de intención es débil: el usuario podría no estar buscando ni siquiera tu categoría de juego. Por eso el objetivo aquí no es volumen de instalaciones sino extraer el perfil de segmento de usuarios. Usas discovery como arena de prueba A/B: coloca 4-5 conjuntos creativos diferentes (con custom product page), expón cada uno a 5000 impresiones durante 1 semana, realiza cross-check de IPM + D1 retención. IPM por debajo de 4% se rechaza directamente. Si IPM está entre 6-8% pero D1 retención está por debajo de 35%, el creativo es engañoso: cambia la escena de cierre.

La lógica presupuestaria en discovery es: gasta agresivamente en las primeras 2 semanas (50% del presupuesto total), cuando los datos se estabilizan baja a 30%. Nunca lo cierres porque dejar de generar pruebas de tráfico frío significa perder entrada de segmento para broad match y competitor. En 2026, el machine learning de Apple Search Ads se estabiliza en 72 horas, así que tu CPA alcanza meseta al día 3. Si aún hay volatilidad el día 5, tu targeting es demasiado amplio: añade filtros de edad/género/geografía.

En discovery no usas palabras clave, Apple las empareja automáticamente. Pero puedes agregar listas de palabras clave negativas, especialmente términos vinculados a géneros de juegos rivales (por ejemplo, si tu juego es match-3, haz "battle royale" negativo). Una trampa común: Apple también sugiere por categoría. Si tu juego está publicado en categoría "Casual" pero su mecánica está más cerca de "Puzzle", elegiste la categoría incorrecta en metadata. En este caso, se corrige ASO, no la campaña: cambio de categoría + optimización de subtitle. Si el desempeño de discovery es bajo, lo primero es una auditoría de ASO, no aumentar presupuesto.

## Competitor y Broad Match: Filtro de Calidad y Dinámicas Presupuestarias

Las campañas competitor solo tienen sentido en mercados tier-1. En mercados como Turquía, Brasil, Indonesia, la conciencia de marca es baja, los usuarios no buscan por nombre rival, buscan por término de categoría general. En EE.UU. hay 1 millón de usuarios buscando "Candy Crush", en Turquía apenas 50 mil, por eso asignar presupuesto a competitor en Turquía da ROI negativo. Si estás en tier-1, mantén competitor estrecho: apunta solo a 3-5 juegos en competencia directa. Cada palabra clave debe tener TTR (tap-through rate) mínimo de 5%, por debajo no puedes convertir el usuario rival, cambia el conjunto de icon + screenshot.

En competitor, la estrategia de puja es agresiva: puedes subir hasta 120% de tu CPA máximo porque el usuario rival es calificado, ha jugado un juego similar. Pero después de 2 semanas, mide LTV/D30: si el usuario que viene de competitor tiene 15% menos retención, ese segmento no se alinea con tu mecánica, cierra la campaña. Error común: si el rival es grande, su usuario también funciona para mí. Incorrecto: un usuario de "PUBG Mobile" es completamente diferente a uno de "Among Us", aunque ambos estén en "battle royale".

Las campañas broad match son para términos de categoría: "puzzle game", "strategy rpg", "idle game". Aquí el control exact/broad es configurable. Comienza con broad, después de 1 semana descarga el reporte de search terms, haz negativo los términos no relevantes. Ejemplo: tu juego usa mecánica "merge", pero broad match trae "match-3", entonces haz "match-3" negativo. El presupuesto de broad match debe estar entre 25-35%, más y desperdicias entrada de segmento de discovery, menos y no capturas volumen suficiente.

## Campaña Brand: Defensa e Indicador de Salud de ASO

La campaña brand apunta a tu propio nombre de juego. "Pero ya estamos en primer lugar orgánico, ¿por qué pagar?" es la pregunta equivocada. Aunque estés en primer lugar orgánico en Apple, los rivales pueden apuntar a tu marca en Search Ads, así que cuando buscan "Tu Juego" aparece un rival. La campaña brand protege ese tráfico. Además, el CPA más bajo aparece aquí (generalmente 1/5 del de discovery), así que asignar 15-20% del presupuesto tiene ROI positivo.

La segunda función de brand es servir como indicador de salud de ASO. Si tu CPA en brand sube de repente (por ejemplo, 30% en 2 semanas), significa que tu clasificación orgánica bajó. Porque cuando cae la clasificación orgánica, hay menos visibilidad, el usuario hace clic más en tu campaña brand en Search Ads, Apple cobra más. No puedes resolver esto con optimización de campaña: lo corriges con ASO (densidad de palabras clave, subtitle, IAP naming) y gestión de reseñas. Usa la campaña brand como "sistema de alerta temprana".

Las pujas en brand deben ser agresivas: 150% de tu CPA máximo. Porque si el rival también apunta a tu marca, hay guerra de pujas y si pierdes, el tráfico se va. Algunos equipos dicen "ya conseguiré tráfico orgánico" y ponen puja baja en brand, esa estrategia solo funciona sin competencia. En mercados tier-1 siempre hay competencia, brand es defensa activa, no pasiva.

## Escenario de Flujo Presupuestario: Piloto de 4 Semanas

Digamos que tienes $15,000 en 30 días, lanzas un nuevo juego RPG idle en EE.UU. Semana 1: discovery 50% ($1,875), broad 25% ($937), brand 20% ($750), competitor 5% ($187). Competitor bajo porque no hay perfil de segmento aún. En los primeros 7 días, discovery genera 2,500 instalaciones, mides su D1 retención: 32%. Esperas 1 semana para medir D7.

Día 14: D7 retención es 18% (aceptable para RPG idle). De los usuarios de discovery, 60% son hombres 25-34, 30% mujeres 18-24. Añades este perfil como filtro edad/género a broad match. Revisas presupuesto: discovery 35%, broad 35%, brand 20%, competitor 10%. Porque ahora tienes perfil de segmento, broad match funcionará más calificado.

Día 21: De competitor vienen 150 instalaciones, pero D1 retención es 22%, 10% menos que discovery. Este segmento no se alinea. Cierras competitor, das ese 10% a broad match. Última semana: discovery 30%, broad 45%, brand 25%. Esta distribución ahora se estabiliza. Al final de 30 días: 7,200 instalaciones totales, blended CPA $2.08, D30 retención 9.5%, buen baseline para RPG idle tier-1.

## Medición e Iteración: Qué Señales Observas

Una vez que construyes la arquitectura de campaña, la medición ocurre en 3 niveles: nivel de campaña (CPA, IPM, TTR), nivel de funnel (D1/D7/D30 retención), nivel económico (LTV/CAC). Cada tipo de campaña tiene sus propios criterios. Para discovery, IPM y D1 son suficientes, no esperes LTV porque es tráfico frío. Para broad match, D7 es crítico: por debajo de 15% es inaceptable. Para competitor, TTR es prioritario: por debajo de 5%, el creativo es débil. Para brand, el aumento de CPA es alarma de ASO.

El ciclo de iteración semanal: lunes por la mañana obtén métricas de campaña (Apple Search Ads Console), datos de retención de tu MMP (Adjust, AppsFlyer), proyección de LTV del dashboard. Para viernes, toma decisiones: qué conjunto creativo cerrar, qué palabra clave hacer negativa, qué campaña aumentar presupuesto. Cada dos semanas haces cambios de estrategia más grandes: redistribución de presupuesto en funnel, prueba de nuevo mercado, actualización de ASO metadata.

Una trampa: Apple Search Ads siempre te alerta para aumentar presupuesto. No aumentes cada vez que veas esa alerta. Primero verifica que estés gastando el 100% del presupuesto actual: si está por debajo de 80%, no estás obteniendo suficientes impresiones, el problema es targeting. Si está por encima de 95% y el CPA está dentro del objetivo, aumenta, pero máximo 20%: aumentos abruptos rompen el machine learning.

## Integración con ASO: Metadata Alimenta la Campaña

Las campañas de Apple Search Ads no pueden gestionarse independientemente de ASO. Porque la metadata que muestra la campaña (icon, screenshot, subtitle, promotional text) viene directamente de tu página de App Store. Si IPM es bajo en discovery pero alto en competitor, significa que tu icon se ve genérico, porque los que buscan marca rival ya tienen intención alta, clican aunque el icon no sea atractivo. Pero tráfico frío (discovery) mira el icon, si no engacha, scroll.

Aquí entran las custom product pages (CPP). Apple ahora te permite asignar un CPP diferente a cada campaña. Para discovery usas screenshot set más audaz, animado. Para brand más minimal, logo-forward. Para competitor comparación con rival (si es permitido). Sin esta diferenciación, corres todas las campañas con una sola metadata y el funnel de conversión no se optimiza. La estrategia de CPP debe construirse en paralelo con la arquitectura de campaña en el proceso de [App Store Optimization](https://www.roibase.com.tr/es/aso).

ASO metadata se revisa cada 4-6 semanas cuando el algoritmo de Apple cambia, se actualiza densidad de palabras clave, se gestiona rating/review para prevenir churn, se prueba precios en IAP naming. Estos cambios impactan directamente el desempeño de campaña. Por ejemplo, cambias "merge" por "build" en subtitle, una semana después broad match comienza a traer búsquedas "build game": debes agregar esa palabra clave manualmente. ASO y Search Ads deben ser gestionados por el mismo equipo, en el mismo sprint.

## Conclusión: Arquitectura No es Setup Único, es Sistema Dinámico

Construir arquitectura de campaña como funnel no termina en 30 días. Primeros 30 días piloto, siguientes 60 estabilización, después iteración continua. El flujo presupuestario cambia 10-15% cada mes porque el calendario de live ops (eventos, season, IAP sale) afecta dinámicas de campaña. Cuando discovery es agresivo, broad match desempeña mejor 2 semanas después porque el pool de usuarios está lleno. Cuando CPA en brand sube, se corrige ASO, no se aumenta presupuesto.

Antes de construir esta estructura, pregúntate: ¿está claro el perfil de segmento?, ¿tienes baseline de retención?, ¿es la metadata de ASO testeable?, ¿está la integración MMP sana? Sin estos cuatro componentes, la arquitectura de campaña decepciona. Con ellos, tu eficiencia presupuestaria sube 30-40% en 