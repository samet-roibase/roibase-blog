---
title: "Tech Stack 2026: Operaciones Diarias del Equipo Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patrones de integración y cómo construimos disciplina async-first en equipos distribuidos."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tech-stack, async-workflow, linear, notion, team-operations]
readingTime: 8
author: Roibase
---

En 2026, elegir un tech stack ya no es la pregunta "¿qué aplicación usas?" La pregunta real es: cómo integras estas herramientas, cómo reduces el costo de cambio de contexto, cómo estableces disciplina async-first. En Roibase, un equipo multidisciplinario de 12 personas —marketing, data, headless commerce, estrategia de marca— opera sobre una única stack operacional. En este artículo compartimos nuestras 5 herramientas core y los patrones de integración que hacen esto posible. Métrica numérica: promedio 2.3 horas de reuniones por día, response time async menor a 4 horas, predictibilidad de sprint velocity 87%.

## Linear: No Backlog, Disciplina de Sprint

Usamos Linear desde 2024. La razón de la migración desde Jira: velocidad y consenso forzado. En Linear, cada issue se vincula obligatoriamente a un cycle (sprint) — no puedes acumular backlog. Nuestros cycles son de 2 semanas, empiezan el lunes. Al inicio de cada cycle, el target de velocity: 40-45 story points por miembro del equipo. Ese número proviene del promedio de los últimos 6 cycles — medición, no estimación.

La característica más poderosa de Linear es su jerarquía proyecto-issue. La usamos así: cada campaña de cliente es un proyecto, dentro hay epics (por ejemplo, "Q3 brand refresh"), y dentro de los epics hay tasks. Los tasks caen automáticamente a Slack — con `/linear create` puedes abrir un issue directo desde un thread de Slack. Esto elimina la fracción "deberíamos mover esta conversación a Linear". El thread se vincula al issue, el contexto no se pierde.

Otra regla: cada issue tiene un único assignee. Si es "lo hacemos juntos", abrimos un issue parent con 2 sub-tasks. Esto corta la incertidumbre de responsabilidad. En retrospectivas de sprint, nuestra tasa de cumplimiento de velocity es 87% — promedio de los últimos 12 cycles. Esta consistencia viene del enforcement de due dates y estimates de Linear.

## Notion: Un Registro, Dos Propósitos

En Notion funcionamos en dos capas: documentación y decision log. Documentación es clásica — onboarding, SOP, runbooks. Pero el decision log es crítico. Cada decisión estratégica (cambio de herramienta, revisión de proceso de onboarding, nuevo JD) se abre como una página en Notion. Template: contexto, opciones (tabla), decisión, justificación. Así, 6 meses después, puedes mirar atrás y responder "¿por qué elegimos esta herramienta?"

La integración Notion-Linear no es nativa aún, la hicimos con Zapier. Cuando un epic se completa en Linear, automáticamente un tag "completed" cae en la página del proyecto en Notion. Es un detalle pero importante — porque los PM's viven en Linear y los stakeholders viven en Notion. Ambos lados necesitan estar actualizados.

El punto débil de Notion: búsqueda. Con 400+ páginas acumuladas, la calidad de los resultados se degrada. Para esto implementamos disciplina de tagging: cada página tiene mínimo 3 tags (equipo, tipo de proyecto, estado). Usamos filtros en lugar de búsqueda — así evitamos el problema de alucinación del motor de búsqueda.

### Knowledge Base vs. Chat Memory

No vinculamos Notion directamente a Slack. Chat es efímero, Notion es persistente. Si una decisión se toma en chat, alguien la transfiere manualmente a Notion. Esta fricción es intencional — no queremos que todo caiga a Notion. Solo información reutilizable llega ahí. Los threads de Slack tienen retención de 90 días — después se archivan automáticamente. Con esta regla, Notion realmente es "el único registro".

## Slack: Async-First, Meeting-Last

Tenemos 42 canales en Slack. Regla: un canal por cliente, un canal por función interna (ejemplo: #data-ops, #brand-strategy). Sin canales privados — transparencia es default. Solo HR en DM. Así la velocidad de onboarding es alta — los nuevos miembros leen el historial del canal en el primer día y captan contexto.

La cultura async-first se sostiene con disciplina de threads. Regla: cada mensaje recibe respuesta en un thread o una reacción. Si un mensaje no obtiene reacción en 2 horas, es señal de "nadie se hace cargo de esto". El tiempo promedio de respuesta en threads es 4.2 horas (últimos 30 días). Esto elimina la necesidad de reuniones síncronas.

La integración Slack-Linear es bidireccional: abres un issue con `/linear` en Slack, y cuando ese issue se actualiza en Linear, la notificación cae en Slack. Así los PM's viven en Linear, los developers en Slack — ambos actualizados. ¿Problema con ruido de notificaciones? Sí. Lo solucionamos así: cada usuario define su keyword de mención (por ejemplo, "@juan-urgente"), solo eso genera push notification. El resto cae en un canal "Updates" que se lee de forma async.

## Figma: Handoff de Design, Sin Quejas

Figma en Roibase no es solo UI/UX, también gestión de assets de marca. Cada cliente tiene un Figma workspace — variantes de logo, paleta de color, sistema tipográfico, plantillas de slides, todo ahí. El handoff a desarrolladores es mediante el inspection mode de Figma — sin discusiones sobre "¿qué hex es ese azul?"

La integración Figma-Notion es manual. Cuando el design se finaliza, incrustamos el link de Figma en la página del proyecto en Notion. Así los stakeholders ven el design sin salir de Notion. No usamos el feature de comentarios de Figma — porque los comentarios viven en Figma, no caen a Slack. Todo feedback se centraliza en threads de Slack, luego el designer lo transfiere a Figma.

El version control de Figma es poderoso pero la convención de nombres es tu responsabilidad. Nuestra regla: cada revisión mayor se nombra "v1.0", "v2.0". Las iteraciones menores son "v1.1", "v1.2". Así puedes decir al cliente "aprobó v2.3" — sin ambigüedad de qué archivo es.

## Granola: Convertir Reuniones en Artifacts Async

Agregamos Granola a finales de 2025. Es un AI meeting note tool — pero nuestro caso de uso es diferente. Granola no solo genera transcripts, extrae action items. Cuando termina una reunión, Granola abre automáticamente un issue en Linear y asigna responsables. Así se evita la fracción "¿la reunión entró a Linear?"

La mejor característica de Granola: envía el resumen de la reunión a Slack por webhook. La reunión termina y 5 minutos después, los miembros del equipo que no asistieron leen el resumen en #meeting-notes. Esto genera transparencia async — reduce el FOMO (fear of missing out) y disminuye las participaciones innecesarias en reuniones.

Granola aún no tiene integración nativa con Notion. Lo hacemos manual: los resúmenes de reuniones estratégicas con clientes se copian al decision log de Notion. Esta fricción es intencional — no queremos que toda reunión caiga a Notion. Solo decisiones estratégicas entran ahí.

## Patrones de Integración: Colocar Fricción Estratégicamente

El éxito de un tech stack no está solo en qué herramienta elijas, sino dónde coloques fricción. Tenemos 3 fricciones intencionales:

1. **Slack → Notion:** No es automático. Las decisiones de chat se transfieren manualmente. Así Notion no acumula ruido.
2. **Figma → Linear:** Sin integración de comentarios. El feedback se centraliza en Slack. Así el feedback tiene un único punto de origen.
3. **Granola → Notion:** No es automático. Las reuniones críticas se transfieren manualmente. Así el decision log de Notion mantiene calidad.

Estas fricciones van contra la lógica "todo automático" pero son intencionales. Porque el costo de la automatización es: perder dónde vive la información. Colocamos fricción para crear jerarquía de información: Slack es efímero, Linear es scope de sprint, Notion es estratégico.

## Resultado Numérico: Eficiencia Operacional

Datos Q2 2026:
- Promedio diario de reuniones: 2.3 horas (Q2 2024: 4.1 horas)
- Response time async: 4.2 horas (target: menor a 4 horas)
- Predictibilidad de sprint velocity: 87% (últimos 12 cycles)
- Median tiempo Linear issue (apertura a cierre): 3.8 días
- Páginas Notion: 412 (activas), uso de filter vs. search: 78%

Estas métricas vienen de disciplina de integración, no solo de selección de herramientas. Si Linear, Notion, Slack vivieran como silos separados ("la mejor herramienta para X"), el costo de cambio de contexto sería el doble de hoy. Diseñamos deliberadamente los patrones de integración — especialmente los puntos de fricción — para mantener velocidad operacional.

Un tech stack no es solo una lista de software. Es disciplina de equipo, convenciones de nombres, cultura async, reglas de accountability — todo junto. Como en nuestro trabajo de [Posicionamiento y Estrategia de Marca](https://www.roibase.com.tr/es/branding), la identidad operacional también requiere un patrón consistente. Las herramientas cambian, el patrón permanece.