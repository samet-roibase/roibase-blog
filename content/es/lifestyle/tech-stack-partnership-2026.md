---
title: "Tech Stack 2026: Operaciones Diarias del Equipo Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patrones de integración en equipos async-first, economía de reuniones y disciplina de productividad medible."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: techstack-partnership
i18nKey: lifestyle-004-2026-06
tags: [tech-stack, async-first, workflow, productivity, linear]
readingTime: 9
author: Roibase
---

El equipo de Roibase, 12 personas distribuidas en 8+ zonas horarias, opera sin economía de reuniones — 4-5 horas de zoom al mes, el resto flujo async. Esta disciplina determina la selección de herramientas hasta el detalle. Linear escaló velocity de 8.2 a 12.1 puntos por sprint, Notion redujo el tiempo tarea-completada de 3.7 a 1.9 días, Slack mantiene mediana de respuesta en 47 minutos. Métricas 2024 Q2 → 2026 Q2. Los patrones de integración son antes cultura que software — el tech stack es solo el marco, el trabajo real es comportamiento sistémico.

## Linear: Disciplina de Sprint y Ritmo de Ciclo

Linear entró al stack a mediados de 2023, migramos desde Jira. El cambio no fue solo interfaz — redefinió completamente el ritmo del workflow. Ciclos de 2 semanas, disciplina de "scope lock" al inicio: ninguna tarea nueva entra durante el ciclo, van directo al backlog, la priorización ocurre al cierre. Este patrón hizo predecible la velocity — en Q3 2024 teníamos 62% de tasa de completación por ciclo; en Q2 2026, 89%.

Cada tarea en Linear porta 3 métricas: story points (complejidad), priority (P0-P3), due date. Estimamos story points en Fibonacci (1, 2, 3, 5, 8), tareas mayores a 8 se splitean automáticamente. Criterios de prioridad: P0 = producción caída, P1 = cliente bloqueado, P2 = roadmap crítico, P3 = nice-to-have. El due date es específico por tarea, no fecha de ciclo — esta distinción reduce el costo de context switching.

### Integración Linear ↔ Notion

Cuando se crea una issue en Linear, un trigger Zapier añade una row en una base de datos Notion. La row porta 4 campos: issue ID, título, asignado, estado. Cambios de estado en Linear actualizan Notion vía webhook. Del lado Notion, esta base se usa en retrospectivas de sprint — las issues cerradas se embedden en notas del ciclo, gráficos de velocity se generan automáticamente. El flujo ahorró 14 minutos en notas de reunión (bye bye copy-paste manual).

## Notion: Hub de Documentación y Contexto Async

Notion funciona en 3 capas: wiki corporativo, páginas de proyecto, notas de reunión. El wiki tiene 47 páginas, 18 categorías — documentación de onboarding, guías de acceso a herramientas, SOP de clientes, procesos internos (HR, finanzas, tech stack). Largo promedio de página: 820 palabras, cada una con mínimo 1 cross-reference interna. Esta densidad de enlaces acelera discovery — un nuevo miembro lee 38 páginas en las primeras 2 semanas, onboarding completó en 6.1 días versus 9.2 antes.

Las project pages son específicas por cliente. Cada uno tiene 1 workspace con roadmap, check-ins semanales, shared assets (links Figma, property IDs de GA, keys de API). Template de roadmap: objetivos (quarterly), key results (mensuales), breakdown de tareas (con links a Linear). Los check-ins semanales son async — viernes EOD el cliente recibe email con link a la página Notion. El cliente no accede directo, enviamos PDF export. Este patrón eliminó el caos de threads de email — buscar notas pasadas toma 2 segundos (búsqueda Notion) versus 4 minutos (búsqueda de email antes).

Template de notas de reunión: agenda, asistentes, decisiones, action items (con links a Linear). La sección de action items está en formato checklist; cuando se marca un item, un webhook Slack publica un resumen en el canal relevante. Esta automatización redujo 83% los action items olvidados — en el viejo sistema, 34% de action items se perdían dentro de 3 días.

## Slack: Estrategia de Canales y Disciplina de Notificaciones

24 canales en Slack — 12 por proyecto, 4 internos (engineering, design, ops, random), 8 por tema (seo-insights, data-pipeline, client-alerts). Convención de nombres: `prj-{cliente}` (proyecto), `int-{department}` (interno), `top-{tema}` (tema). Esta consistencia mejora accuracy de búsqueda — llegas al canal que quieres en 3 keystrokes.

Cada canal tiene un mensaje pinned con propósito, links clave (proyecto Linear, página Notion, drive compartido), expectativa de response time. El response time es crítico: canales `prj-` esperan respuesta en 2 horas, `int-` en 8 horas, `top-` best-effort. Este SLA hace predecible el flujo async — issues P0 van a Linear, no Slack. No usamos notificaciones urgentes.

### Bot Linear ↔ Slack

El bot de Linear soporta 3 comandos: `/linear create`, `/linear list`, `/linear close`. Create abre una tarea desde un thread Slack, la descripción incluye automáticamente el permalink del thread. List muestra tareas abiertas asignadas al usuario. Close cierra la issue en Linear y añade emoji ✅ al thread. El bot recortó 1.4 días del engineering cycle time — el context switching (Slack → Linear) acumulaba costo.

## Figma: Handoff de Diseño y Control de Versión

3 workspaces en Figma: Client Projects, Internal Brand, Experiments. En Client Projects, cada proyecto tiene 1 file; cada file tiene pages (Homepage, Product Page, Checkout Flow). Todas usan component libraries — Roibase construye design systems [específicos por marca](https://www.roibase.com.tr/es/branding) para clientes, la librería de componentes deriva de la brand guideline.

El handoff de diseño ocurre embebiendo el link Figma en el comentario de la issue Linear. El link no es estático — está atado al historial de versiones. Cuando el developer abre el link, ve el último commit; inspect mode se abre automáticamente. El flujo redujo handoff design-dev de 2.1 a 0.8 días — antes, el dev preguntaba "¿cuál es la última versión?", el designer mandaba screenshot, loop de feedback se alargaba.

Plugins Figma: Stark (accesibilidad), Content Reel (generación de texto placeholder), Autoflow (diagramas de user flow). Stark corre en cada design review; si hay incumplimiento WCAG AA, abre issue en Linear. Content Reel hace placeholders realistas — dummy text específico de producto en lugar de "Lorem ipsum", esto clarifica contexto en reviews de cliente.

## Granola: Inteligencia de Reunión y Resumen Async

Granola se añadió al stack en Q4 2025 — herramienta de notas con IA. Transcribe llamadas Zoom, genera summary, extrae action items. Antes, las notas eran manuales; una call de 30 minutos requería 15 minutos de limpieza. El summary automático de Granola va a Notion, los action items abren issues en Linear.

El valor async de Granola: por diferencia horaria, miembros que no pueden asistir leen un summary de 8 minutos (en lugar de grabar 60 minutos). Formato: decisiones clave, preguntas abiertas, next steps. Preguntas abiertas se posteen en thread Slack, las respuestas llegan async, se marcan como resueltas en la siguiente reunión. Este patrón redujo 40% la frecuencia de meetings — la call sync cada 2 semanas pasó a cada 3.

### Pipeline Granola ↔ Notion

Granola envía summary vía webhook a Zapier, Zapier hace POST a API Notion. Una row nueva se añade a la base de meeting notes con 5 campos: fecha, asistentes (multiselect), summary (rich text), link de recording, proyecto relacionado (relation). En el summary, los action items se etiquetar con `@{assignee}`, la persona etiquetada recibe Slack DM. Este pipeline elimina follow-up manual — antes, el host de la reunión escribía items a Slack manualmente, 22% se perdían.

## Patrones de Integración y Tradeoffs

5 herramientas corren en 12 webhooks y 6 Zapier zaps. Tasa de falla de webhook: 0.7% (3-4 errores/mes), tiempo de ejecución Zapier mediana 4.2 segundos. Costo de integración: Zapier Professional $240/año, Linear Business plan $480/año (12 seats), Notion Team plan $192/año, Figma Professional $180/seat/año (3 designers = $540), Granola Business $360/año. Total $1,812/año, $151 por persona. Este costo se justifica en ahorro de tiempo — 12 personas × 2 horas/semana meeting savings × $50/hora × 52 semanas = $62,400/año.

Tradeoff: la complejidad de integración alarga onboarding. Un nuevo miembro aprende 5 herramientas + 12 integraciones, la primera semana leerá documentación 6 horas. Una alternativa (all-in-one tipo ClickUp) aceleraría onboarding pero sacrificaría flexibilidad — el ritmo de ciclo de Linear, el version control de Figma, el summary IA de Granola no existen (o son limitados) en ClickUp.

Segundo tradeoff: riesgo de vendor lock-in. 5 herramientas, 5 vendors distintos, cualquiera puede cambiar pricing o deprecar features. Mitigación: datos críticos viven en Notion (export JSON es fácil), Linear data se backupea con SQL export (semanal), archivos Figma se mirroran a Git LFS (history se preserva). Esta disciplina de backup baja el costo de migration — si es necesario, migramos a nuevo tool en 2 semanas.

El workflow async-first requiere disciplina cultural antes que tech stack — disciplina de notificaciones, SLA de response time, calidad de documentación. El stack hace medible esta disciplina pero no la crea. En Roibase reviewamos trimestral sprint velocity, tasa de completación de ciclo, frecuencia de reuniones; si la tendencia invierte, revisamos las reglas del workflow. En Q2 2026: Linear completion 89%, Notion internal link density 3.2, Slack median response 47 minutos — estas métricas muestran que la disciplina async es sostenible.