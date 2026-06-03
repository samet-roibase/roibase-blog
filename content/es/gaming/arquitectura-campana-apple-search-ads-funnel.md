---
title: "Apple Search Ads: Arquitectura de Campaña como Funnel"
description: "Estructura Discovery, Competitor, Brand y Broad Match con lógica de funnel. Integración de ASA con LTV y optimización por D7 ROAS."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-funnel, mobile-acquisition, match-type-strategy, gaming-ua]
readingTime: 8
author: Roibase
---

Apple Search Ads como herramienta de PPC basada en keywords terminó en 2021. En 2026, ASA es una operación de funnel. Capas de campaña que se extienden desde Discovery hasta Brand, presupuestadas con estimaciones de LTV y optimizadas por D7 ROAS, no por volumen de instalaciones. La mayoría de equipos siguen usando broad match en una sola campaña y se quejan de que "no escalamos". El problema no es presupuesto, es diseño arquitectónico.

## Campaña Discovery: Rastrear el Pool de Tráfico Frío

La campaña Discovery se estructura para leer el comportamiento de búsqueda de usuarios que nunca han escuchado hablar de tu app en la App Store. Se seleccionan 200-500 keywords genéricos con broad match, el presupuesto diario se mantiene bajo (50-100 dólares en tier-1), pero se empuja el search impression share hacia 100%. El objetivo no es volumen de instalaciones, sino recopilar datos de Search Match.

72 horas después de lanzar la campaña, analiza el reporte de Search Match. ¿En qué queries obtuviste impressiones? ¿Qué keywords generaron instalaciones? ¿Cuáles son spam? Este dato valida o refuta tu estrategia ASO. Por ejemplo, si enfatizas "puzzle" en metadata pero Search Match muestra TTR alto en queries de "idle game", hay desalineación entre ASO y UA.

En la capa Discovery, el CPT (costo por tap) es 35%-50% más bajo porque la competencia es escasa en keywords desconocidos. Pero la conversion rate (tap-to-install) es débil. Esto es normal. El propósito de Discovery es alimentar el funnel, no hacer volumen de instalaciones. 200-300 instalaciones semanales son suficientes; 15% van a la lista de palabras clave negativas, el resto se filtra hacia capas competidora y brand.

### Regla de Presupuesto Discovery

El presupuesto diario de Discovery no debe exceder 10%-15% de tu gasto total en ASA. Ejemplo: en 30.000 dólares mensuales de ASA, asignas 100 dólares/día a Discovery. El presupuesto es fijo, sin target de CPA, usando bid manual (típicamente 0.30-0.50 dólares en tier-1). Después de 14 días, los keywords de alto rendimiento del Search Match se transfieren como exact match a la campaña competidora.

## Campaña Competitor: Competir por la Marca Rival

La capa competidora apunta a nombres de marca de juegos rivales con exact match. "Candy Crush", "Clash of Clans", "Subway Surfers" funcionan en esta capa. La estrategia debe ser oportunista, no agresiva. Si el rival usa max bid en su propio brand term, tu oferta se mantiene en 60%-70%, no buscas posición uno.

El CPT de las campañas competidoras es 80% más alto que en Discovery, pero el TTR sube a 12%-18% (en Discovery es 3%-5%). La conversion de instalaciones es débil porque el usuario estaba buscando otro juego. El D1 retention ronca 25%-30%, mientras que en instalaciones orgánicas es 45%-50%. Pero en ciertos escenarios expande el pool total de LTV.

El KPI de la capa competidora es "incremental ROAS". Cuando pausas el keyword rival, ¿tu volumen total de instalaciones cae 10%? Si cae, la campaña genera incrementalidad. Si no cae, el mismo usuario ya venía de Discovery o Brand, hay canibalización. Un test de incrementalidad de 14 días es obligatorio.

| Tipo Match | CPT (tier-1) | TTR | D7 ROAS Meta | Asignación Presupuesto |
|---|---|---|---|---|
| Discovery (broad) | $0.40 | 3%-5% | Modo test | 10% |
| Competitor (exact) | $1.20 | 12%-18% | 80%+ | 25% |
| Brand (exact) | $0.60 | 25%-35% | 200%+ | 50% |
| Generic (broad) | $0.70 | 6%-9% | 120%+ | 15% |

## Campaña Brand: Proteger Tu Propia Marca

La campaña brand se estructura para evitar que rivales capturen usuarios que buscan tu juego. Keywords como "Roibase Puzzle", "Roibase Game", "Roibase RPG" se apuntan con exact match. En esta capa se usa max bid porque incluso el ranking orgánico puede perder contra anuncios rivales.

El CPT de las campañas brand es el más bajo (0.40-0.80 dólares en tier-1). TTR 25%-35%, install CR 60%-70%, D7 retention 50%+. Este usuario ya conoce tu juego, lo iba a descargar. La pregunta es: "¿Sin esta campaña brand, el usuario completaría la descarga de forma orgánica?" La respuesta típicamente es "sí", pero si un rival también anuncia en tu brand term, la campaña se vuelve obligatoria.

El presupuesto de brand constituye 40%-50% del gasto total en ASA. Parece alto, pero es una posición defensiva. Cuando un rival apunta a tu brand term, tú haces lo mismo con el suyo — equilibrio de MAD (destrucción mutuamente asegurada). En 2026, en tier-1, casi todo juego hace defensa de brand; quien no la hace pierde 10%-15% de instalaciones orgánicas.

### Test de Pausa de Campaña Brand

Si ningún rival apunta a tu brand term, pausa la campaña por 7 días. ¿Caen las instalaciones orgánicas? Si no caen, la campaña brand está inflando tu presupuesto UA pero sin valor incremental. Si caen (típicamente 8%-12%), mantén la campaña activa pero establece un CPA cap (15% del LTV del usuario orgánico como límite superior).

## Modo Broad Match: No Descubrimiento, Sino Herramienta de Escala

Broad match no debe confundirse con Discovery. Discovery usa broad match pero con low bid + low budget. Una campaña de escala broad match usa high bid + high budget para ganar impression share en términos genéricos. Keywords como "puzzle game", "idle rpg", "strategy mobile" funcionan en este modo.

El riesgo de broad match es "query irrelevante". Anuncias en "puzzle" pero Search Match también te muestra en queries como "puzzle solver app" o "puzzle table" — fuera de gaming. Tu lista de palabras clave negativas debe tener 200+ términos. Los primeros 7 días requieren revisión manual — Search Match revisado diariamente.

El presupuesto de broad match no debe exceder 15%-20% del gasto total en ASA. Ejemplo: con 30.000 dólares mensuales, asignas 5.000 dólares a broad match. El target de CPA es 20%-30% más alto que en campañas exact match porque funciona arriba en el funnel. El target de D7 ROAS es 100%-120%. Si cae por debajo, no pausas — reduces bid para mantener la campaña recopilando datos.

## Flujo de Presupuesto: Migración de Usuarios Etapa por Etapa del Funnel

Una arquitectura ASA saludable transporta usuarios de Discovery hacia Brand. Un usuario expuesto por primera vez en Discovery típicamente busca el nombre de tu juego en la App Store en 48-72 horas — ahí tu campaña brand lo captura. Para medir este flujo, usa los datos de atribución de Apple: "Custom Product Page" — qué campaña hizo first touch, qué campaña generó la instalación.

La distribución de presupuesto se estructura así: Discovery se mantiene fijo (100 dólares/día), Competitor y Broad Match se ajustan semana a semana según CPA, y Brand corre en modo "always on" con presupuesto máximo. El gasto total se reduce si D7 ROAS cae bajo target — primero se cierra Competitor, luego se pausa Broad Match, Discovery y Brand continúan.

Flujo de ejemplo: En mayo, Discovery generó 250 instalaciones, 12% de ellas (30 usuarios) buscaron el nombre de tu juego en 72 horas e instalaron desde Brand. El LTV promedio de estos 30 usuarios fue 40% más alto que el grupo que instaló directamente desde Discovery. Este dato prueba que Discovery no solo genera instalaciones directas, sino también lift de brand indirecto.

### Tabla de Atribución de Funnel

```
Campaña          | Gasto    | Instalaciones | LTV Directo | Instalaciones Asistidas | LTV Blended
-----------------|----------|---------------|-------------|-------------------------|-------------
Discovery        | $3,000   | 250           | $4.20       | 30 (brand)              | $5.80
Competitor       | $7,500   | 420           | $6.10       | 15 (brand)              | $6.50
Brand            | $15,000  | 1,200         | $12.40      | —                       | $12.40
Broad Match      | $4,500   | 310           | $5.30       | 22 (brand)              | $6.00
```

## Campaign Budget Optimization: Nuevo Algoritmo de Apple

Desde 2025, Apple Search Ads está testeando "Campaign Budget Optimization" (CBO), similar al portfolio bid en Google App Campaigns: presupuesto único, múltiples campañas, machine learning desplaza gasto automáticamente a la mejor performance. Usar CBO en gaming UA es riesgoso. El algoritmo no considera el target de D7 ROAS, solo maximiza volumen de instalaciones.

Si activas CBO, la campaña Brand absorbe 70%-80% del presupuesto porque su CPA es el más bajo. Discovery y Competitor quedan sin fondos. Resultado: el volumen de instalaciones no baja inicialmente pero la alimentación del funnel superior se detiene; en 3 semanas, incluso el volumen de Brand comienza a caer. Usa CBO solo en estos casos: combinar campañas con CPA similar, como Brand + Broad Match.

## Qué Capa Se Cierra Cuando el Rendimiento Falla

La decisión de cierre depende de incrementalidad, no de CPA. Una campaña Competitor está 30% arriba del target de CPA pero pausa reduce instalaciones totales 8% — es incremental, sigue corriendo con bid optimizado. Una campaña Broad Match cumple el target de CPA pero pausarla no cambia el volumen total — está canibalizando, se cierra.

Discovery nunca se pausa. Su presupuesto puede reducirse pero nunca a cero. Porque su objetivo no es ROAS inmediato, sino validar hipótesis de ASO y alimentar el pool de datos de Search Match. Brand tampoco se pausa nunca. Si un rival apunta a tu brand term, tú defiendes tu posición — equilibrio MAD.

Si no integras la arquitectura de funnel ASA con tu estrategia de [App Store Optimization](https://www.roibase.com.tr/es/aso), el rendimiento de tu campaña llegará a plateau en 3-4 semanas. Los keywords enfatizados en metadata deben ser consistentes con los términos apuntados en ASA. Si un keyword en Discovery muestra TTR inesperadamente alto en Search Match, agregarlo a metadata de ASO incrementa install CR 10%-15%.