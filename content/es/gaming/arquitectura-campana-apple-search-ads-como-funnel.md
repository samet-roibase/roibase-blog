---
title: "Apple Search Ads: Estructurar la Arquitectura de Campañas como Funnel"
description: "Discovery, competidor, marca, broad match — gestionar el flujo presupuestario con lógica de funnel. Optimización install-to-LTV en mercados Tier-1."
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, arquitectura-campana-asa, mobile-user-acquisition, funnel-optimization, gaming-growth]
readingTime: 8
author: Roibase
---

Si gestionas campañas de Apple Search Ads con un único nivel de broad match, estás gastando el 40% del presupuesto en usuarios equivocados. En 2026, la capacidad de aprendizaje algorítmico de ASA ha aumentado, pero sin lógica de funnel, la máquina te enseña señales incorrectas. Discovery tiene installs más baratos, marca tiene LTV D7 más alto — pero si los mezclas, pierdes ambos. Estructurar la arquitectura de campañas como capas de funnel no es solo eficiencia presupuestaria, es alimentar correctamente la señal de atribución.

## Capa Discovery: Trabajar con Broad Match como Motor de Exploración

La campaña de Discovery existe para usar la red amplia de ASA y encontrar nuevos segmentos de usuarios. Broad match, keyword genérico, término de categoría — volumen de installs alto, IPM bajo, pero estás generando señal de aprendizaje. El algoritmo aún no sabe qué perfil encaja en tu juego, y tú tampoco puedes adivinarlo. El objetivo de Discovery es identificar en las primeras 72 horas qué usuarios muestran engagement.

La asignación presupuestaria en la capa Discovery debe ser 25-30% del gasto total en ASA. Si superas esto, el CPI parece bajo pero el LTV no regresa. Si está por debajo, te quedas rebotando dentro de la audiencia que los competidores ya descubrieron, sin alcanzar nuevos segmentos. Ejemplo: si tu presupuesto mensual de ASA es $50K, dedica $12-15K a Discovery. El objetivo de la campaña no es CPT (cost-per-tap) sino CPIn (cost-per-install) porque en esta capa importa el volumen, no la calidad del tap.

Estrategia de keywords:

- Términos de categoría (ej. "puzzle game", "strategy rpg")
- Búsquedas de intención amplia ("free games", "offline games")
- Nombres de juegos rivales (con broad match, también se activan juegos relacionados)

En campañas Discovery, conforme añades negative keywords reduces tu espacio de aprendizaje. Durante las primeras 2 semanas trabaja sin añadir ningún negative, a partir de la semana 3 bloquea search terms donde el D1 retention esté por debajo del 15%.

## Capa Competidor: Usar Exact Match para Robar Usuarios del Rival

La campaña de Competidor apunta al tráfico de intención más alta de ASA. Cuando un usuario busca el nombre de un juego rival, tiene una intención clara de descargar — tu trabajo es ofrecer una alternativa. Con broad match capturarías búsquedas "cercanas" al rival, pero la capa de Competidor debe trabajar con exact match porque el control presupuestario es crítico. El usuario que busca el nombre del rival quiere ese juego, una alternativa, o ya lo juega y busca algo nuevo.

Rango presupuestario: 20-25%. Conforme aumenta el número de rivales, este porcentaje puede crecer, pero no trates todos los rivales por igual. Rival Tier-1 (líder de mercado, mecánica similar a la tuya) no tiene el mismo CPI que rival Tier-2 (mecánica diferente, pero perfil de usuario similar). Para rivales Tier-1, multiplicador de bid 120-150%, para Tier-2, 80-100%.

En campañas de Competidor, la diferencia creativa es determinante. El usuario ya conoce el rival, tu custom product page debe establecer comparación — pero sin mencionar nombres explícitamente. Ejemplo: si el rival usa combat por turnos, tu CPP debe destacar "PvP en tiempo real". El trabajo en [App Store Optimization](https://www.roibase.com.tr/es/aso) de variantes de CPP específicamente para esta capa incrementa IPM 18-25%.

La señal negativa es crítica: no intentes recapturar usuarios que descargaron el rival y después lo eliminaron. ASA no tiene nativamente una señal "previous downloader", pero si el D1 retention está por debajo del 10%, ese segmento de usuario ya está quemado.

## Capa Marca: Exact Match para Defender Usuarios Existentes

La campaña de Marca es tu línea defensiva en ASA. El usuario que busca tu nombre de juego ya te conoce — pero los rivales están haciendo publicidad sobre tu término de marca. Sin campaña de Marca, el anuncio rival aparece encima del tuyo y pierdes 8-12% de usuarios. Esta capa genera el CPI más bajo pero tráfico pequeño, con el LTV más alto porque el usuario llega consciente.

Rango presupuestario: 10-15% — pequeño pero ininterrumpido. Si pausas la campaña de Marca, el rival se da cuenta en 48 horas y aumenta su bid. La estrategia de keywords es solo el nombre del juego y variantes:

| Tipo de keyword | Ejemplo | Match type |
|---|---|---|
| Nombre del juego | "Your Game Name" | Exact |
| Abreviatura | "YGN" | Exact |
| Variantes con typo | "Your Gam Name" | Broad (solo para typos) |

En la campaña de Marca, no hagas A/B testing de creativas. El usuario ya conoce tu juego, la consistencia importa — icon de app, logo del juego, personaje conocido. Si usas variantes de CPP, lo confundes.

La estrategia de bid puede ser baja porque Apple te da ventaja en términos de marca. Incluso si el rival puja al 150%, tu bid del 100% aparecerá arriba. Pero no reduzcas a cero, se necesita bid mínimo de ~$0.50 para evitar que el rival empuje la lista orgánica.

## Modo Broad Match: Uso Diferente en Cada Capa

Broad match en ASA no es un solo ajuste, sino una herramienta que sirve a propósitos diferentes en cada capa. En Discovery es herramienta de exploración — máximo reach, mínimas negativas. En Competidor es riesgoso porque activa búsquedas irrelevantes y dispersa presupuesto. En Marca se usa solo para variantes con typos.

La capacidad de aprendizaje del broad match aumentó en 2026, pero aún requiere mecanismos de control. El algoritmo de ASA aprende qué search term genera conversiones, pero no puede saber qué perfil de usuario genera D7 LTV. Por eso las campañas con broad match deben analizarse en ciclos de 14 días:

1. **Días 1-7:** Trabaja sin añadir negatives, recopila reporte de search terms
2. **Días 8-14:** Añade negatives para terms con D1 retention <15%, aumenta bids en 10%
3. **Días 15-21:** Revisa datos de D7 LTV, actualiza lista negativa

En campañas de broad match, el multiplicador de bid debe ser 80-90% para Discovery, 100-120% para Competidor. Cuando el algoritmo busca "búsquedas similares", también usa la señal de bid — bid bajo alarga el período de aprendizaje.

## Gestionar el Flujo Presupuestario como Lógica de Funnel

Una vez estructuradas las capas de campaña, el flujo presupuestario debe funcionar como funnel. Discovery genera alto volumen de installs pero LTV incierto, Competidor volumen medio pero LTV predecible, Marca volumen bajo pero LTV alto. La distribución presupuestaria no es fija, se ajusta dinámicamente según reportes semanales de LTV:

**Semana 1 (fase de exploración):**
- Discovery 35%
- Competidor 25%
- Marca 15%
- Reserva 25% (mantén para pruebas)

**Semanas 2-4 (fase de aprendizaje):**
- Discovery 30% (la proporción baja conforme crece la lista negativa)
- Competidor 30% (aumenta para rivales ganadores)
- Marca 15%
- Reserva 25%

**Semana 5+ (fase de optimización):**
- Discovery 25%
- Competidor 35% (escala para rivales con LTV positivo)
- Marca 15%
- Reserva 25% (para eventos estacionales o nuevos tests)

Nunca distribuyas el presupuesto de reserva entre campañas fijas. Mantenlo para oportunidades — event estacional, lanzamiento de feature, actualización grande de rival. Un aumento presupuestario repentino en ASA interrumpe el proceso de aprendizaje del algoritmo; desembolsar desde reserva gradualmente es más eficiente.

## Capa de Medición en la Arquitectura de Funnel

Una vez estructuradas las capas de campaña, la señal de atribución no debe contaminarse. ASA funciona nativamente con SKAdNetwork, pero para métricas post-install como D7 LTV necesitas integración con MMP. Herramientas como AppsFlyer, Adjust o Singular vinculan el ID de campaña de ASA con análisis de cohortes. Cada capa — Discovery, Competidor, Marca — debe tener su propio campaign ID para poder segregar datos de LTV por capa.

Sin infraestructura de medición, la arquitectura de funnel es solo distribución presupuestaria, sin optimización posible. Cada capa tiene su propia métrica de éxito:

| Capa | Métrica primaria | Métrica secundaria | Señal negativa |
|---|---|---|---|
| Discovery | IPM (installs por mil) | D1 retention | CPI >$3 y D1 <15% |
| Competidor | D7 LTV | CPIn | D7 LTV <$2 |
| Marca | CR (conversion rate) | D30 LTV | CPIn >$1.5 |

Las métricas deben analizarse en ciclos de 14 días, no diarios, porque el algoritmo de ASA completa su proceso de aprendizaje en 10-14 días. La optimización diaria contamina la señal.

## Testear y Escalar la Arquitectura de Campaña

En la configuración inicial, comienza con 3 campañas (Discovery, Competidor, Marca). Si tu presupuesto es menor a $10K mensuales, usa múltiples ad groups en una sola campaña, pero esta estructura empaña la capa de LTV. El presupuesto inicial ideal es ~$15K mensuales — a este nivel hay volumen suficiente por capa y el aprendizaje acelera.

Para escalar, profundiza las capas existentes en lugar de crear nuevas. Ejemplo: divide Competidor en Tier-1 y Tier-2, o divide Discovery por geografía (países Tier-1 vs mercados emergentes). Cada nueva división reinicia el ciclo de aprendizaje, así que toma decisiones de escala solo después de que los datos de LTV se estabilicen.

Durante testing, no crees campañas duplicadas. Esto hace que ASA compita tu anuncio contra sí mismo. En su lugar, testa variantes de CPP usando Creative Sets, aplica la variante ganadora a todas las campañas. En el contexto del [Premium Publisher Program](https://www.roibase.com.tr/es/dijitalpazarlama), puedes combinar resultados de ASA creative testing con cross-channel (UAC, Meta) e iterar más rápido.

Una vez establecida la arquitectura de funnel, el mantenimiento es bajo pero continuo. Reporte semanal de search terms, reporte de LTV cada 14 días, análisis de cohortes mensual — no saltes estos ciclos. El algoritmo de ASA te envía señales, tú debes devolverle señales correctas. Lo que aprendes en Discovery, úsalo en Competidor; lo que ganas en Competidor, protégelo en Marca. La arquitectura de campaña no es una lista estática, sino un ciclo dinámico de aprendizaje.