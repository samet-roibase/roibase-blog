---
title: "Contratación Async-First: Filtros Prácticos y Estructura de Entrevista"
description: "Semana de prueba, evaluación escrita y eliminar el sesgo síncrono: guía operacional para probar candidatos con la disciplina real del trabajo remoto."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, contratacion, trabajo-remoto, semana-prueba, construccion-equipos]
readingTime: 8
author: Roibase
---

Construir un equipo async-first no empieza con contratar a alguien cuyo perfil de LinkedIn dice "remote-friendly". El error más común en 2026: diseñar el proceso de selección alrededor de llamadas síncronas, sesiones de "vibe check" y lectura de CVs. Resultado: el equipo trabaja remoto pero necesita 4 reuniones Zoom diarias, cada decisión espera respuesta instantánea en Slack, hay instrucciones verbales en lugar de documentación escrita. Si quieres construir un equipo async-first, necesitas diseñar el hiring también bajo disciplina async — no solo significa "reúnete cuando puedas", sino *probar la capacidad real del candidato para trabajar async*.

## Eliminar el sesgo síncrono: lista de criterios medibles

El primer paso en hiring async-first es separar qué habilidades *realmente* requieren interacción síncrona. Los procesos de selección clásicos intentan responder "¿puede pensar bajo presión?" en una videollamada de 45 minutos. En un equipo async, la pregunta real es: ¿esta persona puede leer contexto en texto, esperar 4 horas y dar una respuesta detallada?

La matriz de filtro que usamos en Roibase desde 2023 se divide en 3 categorías:

**Habilidades async obligatorias:**
- Leer un brief escrito y entregar output inicial sin hacer preguntas
- Response time en Linear task dentro de 24 horas (si se retrasa, escribir una explicación)
- Dejar feedback de 3 párrafos en comentarios Figma — sin pedir una videollamada

**Hybrid aceptable:**
- Primeras semanas de onboarding — 2-3 sesiones síncronas son normales
- Momentos de pivote estratégico — quarterly planning, lanzamiento de features importantes
- Bug crítico/incident — ping instantáneo en Slack puede esperarse

**Habilidades que no se miden en async:**
- Capacidad de brainstorming en pizarra — eso se hace en FigJam async
- "Energía del equipo" — se lee en el documento de cultura escrita
- Tomar decisiones rápido — la decisión se documenta en email/thread en 48 horas

Cuando filtras portafolios de candidatos con esta matriz, descubres que el 60% de personas que dicen "5 años de experiencia remota" en realidad pasaron 5 años en Zoom a tiempo completo. Estas personas se frustran en la primera semana de un equipo async pensando "¿por qué nadie responde en Slack?"

El segundo filtro es preguntar si el candidato *produjo artefactos asíncronos* en sus trabajos anteriores. La pregunta "¿cómo documentaron el proceso de decisión en ese proyecto?" seguida de "nos reuníamos semanalmente para discutirlo" es una bandera roja. "Escribimos 3 opciones con tradeoffs en un log de decisiones Notion, y en 2 días todos dejaban comentarios" es luz verde.

## Evaluación escrita: simulación del trabajo real

Cambiar la entrevista por videollamada por una evaluación escrita no significa solo "envía un email" — significa simular el *contexto completo* que el candidato enfrentará trabajando async con el equipo. Lo formalizamos en 2024, ahora es obligatorio para todos los roles: el candidato responde en 48 horas a un brief similar a una task en Linear, prepara una página Notion en lugar de un video Loom, deja comentarios en un mock-up Figma.

**Formato de evaluación (ejemplo: rol de marketing ops):**

*Brief:* "El ROAS de Google Ads del cliente X bajó 18% en las últimas 4 semanas. En Search Console, 3 keywords principales bajaron 22% en impresiones. En Analytics, la tasa de rebote subió 9 puntos porcentuales. Revisa el dataset abajo (link Google Sheet) y propón un plan de acción de una semana. Formato: página Notion, máximo 800 palabras, mínimo 1 visualización de datos."

*Criterios de evaluación:*
- **Lectura de contexto:** ¿Examinó las 12 tabs del Sheet y se enfocó en la métrica correcta? (peso: 25%)
- **Claridad escrita:** ¿El plan es lo suficientemente específico para que otro lo ejecute? (peso: 30%)
- **Seguimiento async:** ¿Hizo preguntas en comentarios Notion en lugar de Slack? ¿Continuó con otras secciones mientras esperaba respuestas? (peso: 20%)
- **Deadline:** ¿Completó en 48 horas? ¿Si iba a retrasarse, lo escribió con anticipación? (peso: 15%)
- **Formato de output:** Uso de jerarquía de headings en Notion, gráficos inline, listas con bullets (peso: 10%)

El 40% de candidatos que no pasan esta evaluación son los que leen el brief y preguntan en Slack "¿podemos hacer una llamada de 15 minutos sobre esto?" Estas personas se convierten en blockers en un equipo async — exigen una reunión síncrona para cada task.

Al contrario, los candidatos que pasan la evaluación ya saben cómo es: leen contexto en Notion, abren un PR draft en 6 horas, piden feedback en comentarios Figma. La fricción de onboarding baja 70%.

**Anti-patrón:** Presentar la evaluación como "tarea" y luego pedir una videollamada para "explicar qué hiciste". Eso es volver a lo síncrono. La forma correcta: trata la evaluación como una task en Linear, da todo el feedback en comentarios Notion, la conversación pregunta-respuesta sucede en un thread asíncrono. El candidato debería trabajar en la evaluación de la misma forma que trabajaría el primer día.

## Semana de prueba: proceso real, no simulación

Después de CV + evaluación, en el hiring clásico viene "verificación de referencias + entrevista final". En async-first, este paso es: **semana de prueba remunerada** — el candidato se une a un sprint real de 5 días, responde a briefs reales de clientes, trabaja en archivos Figma reales. No es simulación, es producción.

En Roibase, la semana de prueba funciona bajo estas reglas:

**Estructura:**
- **Días 1-2:** Onboarding en documentación — workspace Notion, proyecto Linear, organización Figma. Se abre un canal #trial-week (async, 24 horas response time). Primera task: un "good first issue" del sprint actual — baja complejidad, contexto medio. El output del candidato va al repositorio real.
  
- **Días 3-4:** Segunda task — complejidad media, cross-funcional. Ejemplo: "Diseña un plan de A/B test de landing page para el cliente Y, haz variantes en Figma, documenta setup de Google Optimize." En esta task el candidato coordina con al menos 2 miembros del equipo (uno de design, uno de analytics) de forma asíncrona. La calidad de coordinación es el punto de medición más importante.

- **Día 5:** Retrospectiva — también asíncrona. Página Notion con preguntas: "¿Qué aprendiste? ¿Qué proceso no quedó claro? ¿Qué cambiarías en el primer sprint?" El equipo da feedback en el mismo formato: "¿Cómo fue la calidad del código? ¿Las descripciones de PR fueron suficientes? ¿Response time en Slack?"

**Pago:** Tarifa fija de $500 (rol junior) a $2000 (rol senior) — sin cálculo de horas, porque en async medir horas no tiene sentido. Evaluación basada en output.

**Banderas rojas durante semana de prueba:**
- "¿Podemos hacer una llamada sobre esto?" antes de cada task (3+ veces = rechazo automático)
- Descripción de PR de 2 líneas — "fixed bug" (sin contexto = rechazo)
- Preguntar en Slack "¿esto es urgente?" sin esperar a que le respondan 2 horas después (sin disciplina async)
- Enviar capturas de pantalla en DMs en lugar de comentarios Figma (sin documentación)

**Banderas verdes:**
- Después de completar la primera task, proactivamente arregla un gap de documentación relacionado
- Agrega sus propias preguntas a la descripción de la task en Linear para que otros miembros las vean
- Mantiene el SLA de 24 horas de response pero no responde en 10 minutos a cada mensaje (hay deep work)

La semana de prueba es el punto más crítico en hiring async-first porque el problema que surge aquí es universal: todos que dicen "self-starter, autónomo" en el CV, en la primera task real esperan feedback instantáneo o se desviaron sin contexto. Disciplina async = leer contexto en documentación + actualizaciones en checkpoints intermedios + cumplir deadline. Esta habilidad solo se ve en la semana de prueba.

## Entrevista síncrona cuándo es necesaria: casos excepcionales

Async-first hiring no significa 100% async — hay checkpoints que deben ser síncronos. En Roibase, videollamada es obligatoria en 3 situaciones:

**1. Cultural alignment check (1 vez, 30 min):** Después de la semana de prueba, cuando las habilidades técnicas están confirmadas. En esta llamada se habla: "¿Cómo resolvemos conflictos en el equipo? (¿escrito o videollamada?)", "¿Qué haces cuando se pasa un deadline?", "¿Te sentirías aislado trabajando async?" Estas preguntas no pueden responderse por escrito porque el tono y la duda importan. Pero esta llamada no determina la decisión, es solo confirmación final.

**2. Rol de leadership senior (2-3 llamadas):** Posiciones de director+ no son suficientes con evaluación async + semana de prueba, porque decisiones estratégicas y [branding](https://www.roibase.com.tr/es/branding) requieren discusión en tiempo real. Pero incluso estas llamadas están preparadas con async: escenarios case se envían en Notion días antes, en la llamada se profundiza, después hay resumen escrito.

**3. Conversación sobre equity/co-founder:** Split de equity, vesting schedule, escenarios de exit — estos no se pueden resolver con emails. 2-3 sesiones síncronas son obligatorias. Pero la regla sigue: cada llamada tiene agenda en Notion antes, y cada decisión se documenta en Linear después.

Fuera de estas 3 excepciones, todo es asíncrono. Ejemplo de timeline:

| Semana | Etapa | Formato |
|--------|-------|---------|
| 1 | Review CV + portfolio | Async (comentario Notion) |
| 2 | Evaluación escrita | 48 horas, entrega Notion |
| 3 | Feedback evaluación | Thread asincrónico, turnaround 24h |
| 4 | Semana de prueba | Sprint Linear, tasks reales |
| 5 | Retro + cultural call | Retro async + 1 videollamada (30 min) |
| 6 | Oferta | Escrita, negociada en Notion |

Tiempo síncrono total: 30 minutos. Hiring clásico: 6-8 horas de videollamada. La diferencia: el candidato vio el trabajo real, el equipo probó output real. Videollamada de "¿puedes pensar bajo presión?" no se compara con "trabajó 5 días en un sprint real — aquí está el historial en Linear."

## Anti-patterns en hiring async: errores comunes

4 trampas en las que caen equipos cuando prueban async hiring por primera vez:

**1. "Entrevista async" que es solo videollamada en Loom:** Candidato se presenta en Loom, tú haces preguntas en Loom — no es async, es síncrono asincrónico. Async real: candidato escribe página Notion, tú dejas comentarios Notion, candidato edita 12 horas después. Formato thread, no monólogo de video.

**2. Usar semana de prueba como "freelance gratis":** Algunos dicen "prueba una semana" pero dan un deliverable real de cliente y nunca pagan. Esto es ilegal + no ético. Semana de prueba = evaluación mutua. El candidato también te prueba — calidad de procesos, tools, velocidad de feedback. Si no pagas, pierdes los mejores candidatos (los buenos ya tienen otras ofertas, no harán trial sin pago).

**3. Esperar "respuesta rápida" en evaluación:** Das 48 horas de deadline pero favorizas al que entrega en 6 horas. Esto va contra async — estás recompensando reactividad sobre deep work. Métrica correcta: dentro del deadline + calidad alta. El tiempo de entrega no importa.

**4. Hacer standups síncronos en semana de prueba:** "Somos async pero en trial week hacemos 15 minutos cada mañana." No. La semana de prueba es para probar práctica async — el candidato reporta avance en actualización escrita de Linear task, tú das feedback asincrónico. Si agregas standups, no estás probando disciplina async.

## Conversion rate del funnel de hiring async: nuestros números

En Roibase, funnel de hiring async 2024-2026:

- **Aplicaciones por CV:** 100 personas
- **Invitación evaluación escrita:** 20 personas (50 eliminadas: sin artefactos async en CV)
- **Evaluación completada:** 14 personas (6 saltean deadline o escriben "¿llamada?")
- **Invitación semana prueba:** 8 personas (filtro de calidad evaluación)
- **Semana prueba completada:** 7 personas (1 se retira días 1-2 — decisión mutua)
- **Oferta:** 3-4 personas (1-2 hires según rol)

Conversion rate: 3-4%. Más bajo que hiring clásico, porque disciplina async es habilidad rara. Pero retention en primeros 6 meses: 95% (hiring clásico: 70%). Razón: el proceso simula práctica real, así que no hay sorpresas de "el trabajo no es lo que esperaba."

Además, async hiring abre talent pool global. En 2025 contratamos developer en Argentina, designer en Polonia, marketing ops en Tokyo. Entrevista síncrona habría sido imposible por timezones. Formato async permite que el candidato haga evaluación a su hora, semana prueba sin overlap.

Construir hiring async-first es cambio más profundo que solo "trabajemos remoto". Tratas el proceso como sprint en Linear, la evaluación como página Notion, la semana de prueba como producción real.