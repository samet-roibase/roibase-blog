---
title: "Stack de Herramientas 2026: Cómo Funciona la Semana sin Reuniones en Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patrones de integración probados durante 8 años y criterios concretos para operaciones de equipo asincrónico."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [stack-herramientas, async-first, linear, notion, workflow-design]
readingTime: 8
author: Roibase
---

En 2026, el equipo de Roibase dedica un promedio de 2 horas semanales a reuniones — el resto se sincroniza a través de sprints en Linear, documentos en Notion y threads en Slack. En 2019, esa cifra era de 18 horas. Lo que cambió no fue el tooling, sino el patrón de integración entre herramientas. Una tarea abierta en Linear genera automáticamente un thread en Slack, vincula la especificación en Notion y ancla al frame de diseño en Figma. Este artículo expone la ingeniería detrás de ese sistema de integración — por qué elegimos cada herramienta, qué reglas de automatización implementamos y qué métricas monitoreamos.

## Linear: Más que Rastreador de Tareas, Transportador de Contexto

No usamos Linear como un issue tracker convencional — cada tarjeta es una mini-especificación. Los campos obligatorios al abrir una tarea: métrica objetivo (CTR +5%, TTI <2s), documento Notion relacionado, enlace a frame de Figma. En el momento en que se crea la tarjeta, un thread automático se abre en Slack (integración Zapier), y el equipo comienza la discusión asincrónica. El patrón que emerge: en Linear no existe el concepto de "quick task" — cada tarjeta transporta como mínimo 2 capas de contexto externo.

Monitoreamos la velocidad del sprint, pero en una dimensión distinta: **tiempo de ciclo promedio de la tarea** (horas desde apertura hasta cierre), no cantidad de tareas completadas. Este tiempo fue de 38 horas en 2025 y bajó a 29 horas en 2026. La razón: claridad en la especificación — cuando la métrica objetivo está escrita en la tarjeta de Linear, el 60% de las discusiones en code review desaparece (datos propios).

### Patrón de Integración Linear + Notion

Existe una regla: cada tarjeta en Linear debe enlazar un documento de Notion en el campo `Related Resources` — esta regla se refuerza manualmente desde el inicio del equipo (no automatizamos la validación porque el contexto debe determinarlo el equipo, no un bot). El documento en Notion típicamente contiene 3 secciones: definición del problema, solución propuesta, criterios de aceptación. Una tarjeta en Linear puede derivarse de Notion, pero nunca al revés — la especificación se escribe primero, la tarea se abre después.

Esta disciplina redujo el tiempo promedio de code review de 4.2 horas en 2024 a 2.7 horas en 2026. En revisión, la pregunta "¿por qué esto así?" ya no aparece — la respuesta ya está en Notion.

## Slack: Thread-First, No Canales

Usamos Slack no por canal sino por thread. Está prohibido postear mensajes en canales generales — cada mensaje vive dentro de un thread vinculado a una tarjeta en Linear o a un documento en Notion. Este patrón existe para estructurar la búsqueda. Si buscas en Slack "¿cómo funciona X feature?", automáticamente aparece el ID de la tarjeta en Linear porque Zapier, al crear el thread, embebe el ID en el texto del mensaje.

Nuestro objetivo de tiempo de respuesta asincrónico: 4 horas (dentro de horario laboral). ¿Cómo lo medimos? Median thread response time extraído de la API de Slack Analytics — en Q4 2025 fue 3.2 horas, en Q1 2026 bajó a 2.9 horas. Publicamos esta métrica en cada retrospectiva de sprint, pero no la usamos para evaluación individual — el objetivo es optimización del sistema, no competencia entre personas.

## Figma: Design Tokens Vinculados a Linear

No usamos Figma solo como herramienta de diseño — los design tokens están directamente vinculados a tarjetas en Linear. Cuando un component de botón cambia en Figma, todas las tarjetas en Linear que lo usan reciben etiquetas automáticas (API de Figma + Zapier). El equipo ve qué tareas se ven afectadas en menos de 10 minutos.

Esta integración nació de un hackathon interno en 2024. Inicialmente pensamos que era "over-engineering", pero durante un refresh de marca, actualizamos todos los estados de botón en 3 días — con el sistema anterior hubiera tomado 2 semanas. La sincronización diseño-código es el cuello de botella más grande en proyectos de [marca](<https://www.roibase.com.tr/es/branding>) — esta integración lo redujo en 70%.

### Versionado de Design Tokens

Los design tokens en Figma no están bajo control de versión tipo Git, pero las tarjetas en Linear registran cambios de tokens con timestamp. Una tarea anota "Color CTA de botón cambió de #FF5733 a #E84C3D", este registro se añade automáticamente al changelog de diseño en Notion. Así, la pregunta "¿cuál era este color hace 3 meses?" se responde en 30 segundos.

## Granola: La Herramienta que Convierte Reuniones en Contexto

Dijimos que hacemos 2 horas de reuniones semanales — la mitad son llamadas con cliente, la otra mitad sprint planning. Después de cada reunión, Granola extrae automáticamente transcripción + items de acción. Los items de acción se transforman en tarjetas en Linear (manual pero con template), la transcripción se embebe en Notion. Un miembro del equipo que no asistió a la reunión recupera el contexto completo en 10 minutos — no invertimos tiempo escribiendo notas de reunión.

La característica crítica de Granola: categoriza automáticamente los items de acción (diseño, desarrollo, marketing). Al abrir una tarjeta en Linear, sugiere automáticamente la etiqueta correcta. Este pequeño detalle redujo el tiempo de asignación de tareas post-reunión de cliente de 15 minutos a 3 minutos.

## Notion: Fuente Única, Múltiples Capas

No usamos Notion como wiki — la usamos como una máquina de estados. Cada documento existe en uno de 3 estados: Draft (en escritura), Review (vinculado a tarjeta en Linear, discusión asincrónica), Canonical (documento fuente, inmutable). El cambio de estado es manual pero la regla es clara: pasar de Review a Canonical requiere "approval" reaction de al menos 2 miembros del equipo (en thread de Slack).

Los documentos Canonical son inmutables — si necesita cambios, se abre una nueva versión, el antiguo se archiva con etiqueta "Archived". Esta disciplina garantiza que la pregunta "¿por qué tomamos esta decisión?" siempre tiene respuesta — verificas el archivo, revisakas las tarjetas en Linear de ese período, relees el thread en Slack.

### Vistas de Base de Datos y Etiquetado Automático

Hay 4 bases de datos principales en Notion: Specs, Decisions, Experiments, Changelogs. Cada una se etiqueta automáticamente con Linear y Slack (Zapier + API de Notion). Cuando se crea un documento de Spec, Notion automáticamente obtiene de la API de Linear qué tarjetas lo referencian — este query se ejecuta cada mañana a las 9, manteniendo el documento actualizado.

## 3 Reglas Fundamentales de los Patrones de Integración

Después de 8 años de ensayo y error, el patrón que emerge es: cada herramienta es la "fuente única de verdad" para un dominio específico, y las demás se vinculan a él.

- **Linear:** Fuente de verdad para estado de tarea y timeline. Notion puede escribir specs, pero solo Linear modifica el estado de la tarea.
- **Notion:** Fuente de verdad para documentos de spec y decisiones. Una tarjeta en Linear enlaza a Notion, pero un documento en Notion nunca auto-actualiza una tarjeta en Linear.
- **Slack:** Fuente de verdad para discusión asincrónica. Los threads se crean automáticamente, pero su contenido se migra manualmente a Notion (sin automatización porque el ratio señal/ruido se degrada).

Segunda regla: cada automatización debe ser reversible. Los workflows de Zapier pueden activarse manualmente — el equipo puede "pausar" la regla "cuando se abre una tarjeta en Linear, abre thread en Slack" durante un sprint si es necesario (por ejemplo, para reducir ruido en períodos de desarrollo intensivo). La automatización debe soportar disciplina cultural, no imponerla coercitivamente.

Tercera regla: las métricas se rastrean a nivel de equipo, nunca individual. Tiempo de respuesta en Slack, cycle time en Linear, duración de aprobación de documentos en Notion — todo se publica en cada retrospectiva, pero nada se usa para evaluación de desempeño individual. El objetivo es optimización de sistema, no competencia.

## Por Qué Estas Herramientas y No Otras

No elegimos Jira en lugar de Linear porque Jira no incentiva la escritura de specs — una tarea se abre rápido, el contexto viene después. Linear es lo opuesto: la descripción es obligatoria, no puede quedar vacía. Este pequeño detalle de UX genera una diferencia cultural.

No elegimos Confluence en lugar de Notion porque Confluence apunta a versionado empresarial — demasiado complejo para equipos pequeños. Las vistas de base de datos de Notion son flexibles, sus integraciones con Linear y Slack son lightweight.

No elegimos Discord en lugar de Slack porque la estructura de threads en Discord está gamificada; los threads en Slack son más nativos para contexto laboral. La API de búsqueda de Slack funciona nativamente con IDs de tarjeta en Linear.

No elegimos Adobe XD en lugar de Figma porque la API de Figma es abierta e integrable con Zapier. La API de XD es restrictiva.

No elegimos Otter.ai en lugar de Granola porque Granola extrae items de acción nativamente — Otter genera transcripción pero tienes que extraer manualmente los items de acción.

El stack de herramientas en Roibase no es fijo — en 2024 migramos de Loom a Tella (upload más rápido, soporte nativo para embed en Linear). En 2025 probamos Make.com en lugar de Zapier pero volvimos (los logs de error de Zapier son más legibles). La selección de tools es flexible, pero el patrón de integración es sólido: cada herramienta tiene un dominio único como "fuente de verdad", el resto se conecta a él.