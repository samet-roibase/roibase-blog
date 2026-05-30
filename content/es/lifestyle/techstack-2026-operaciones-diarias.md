---
title: "Stack de Herramientas 2026: Operaciones Diarias del Equipo Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patrones de integración y disciplina de productividad medible en un equipo de growth de 12 personas."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: techstack-partnership
i18nKey: lifestyle-004-2026-05
tags: [stack-de-herramientas, flujo-asincrónico, linear, notion, operaciones-de-equipo]
readingTime: 8
author: Roibase
---

Las conversaciones sobre stack de herramientas suelen degenerar en catálogos de "usamos estas apps". Pero el verdadero problema no son las herramientas aisladas — es el patrón de integración, el costo del cambio de contexto, la disciplina async-first. En Roibase, un equipo de 12 personas ha trabajado remote-first desde 2018. En 2026, nuestras operaciones diarias están configuradas alrededor de 5 herramientas: Linear, Notion, Slack, Figma, Granola. En lugar de listar herramientas, exponemos la capa de integración — dónde viven los datos, qué workflow dispara qué, qué capa de notificaciones está apagada.

## Linear: No Sprints, Métricas de Flujo

Linear se vende como herramienta de gestión de proyectos, pero en Roibase funciona como "capa de visibilidad de trabajo en progreso". No hacemos planificación de sprints — no usamos ciclos ni hitos. En cambio, cada issue recibe **priority (P0/P1/P2)** y **estimate (1-3-5-8)**. La prioridad no la decide la persona — la decide el sistema: P0 = bloquea deployment hoy, P1 = debe cerrarse en el ciclo, P2 = backlog.

**Métricas de flujo:**
- **Cycle time:** Del abierto de issue al cierre, promedio 2.3 días (datos Q4 2025). Cualquier issue que exceda 5 días se auto-promueve a P0.
- **Límite de trabajo en progreso:** Máximo 3 issues abiertos por persona. Para tomar un 4º issue, debe cerrar uno o delegarlo.
- **Tiempo merge-to-close:** Desde que un PR se fusiona hasta que el issue se cierra en Linear — objetivo <30 minutos (automatización CI/CD + QA).

La integración de Linear con Slack está desactivada. En lugar de bombardeo de notificaciones, **sistema de digest**: cada mañana a las 09:00 se envía un resumen diario al canal Slack (cantidad de issues P0, cycle time promedio, distribución de WIP). Nadie menciona a otros en Linear — todos leen el digest por la mañana.

### Sincronización Linear → Notion

Los issues completados se archivan en Notion semanalmente (workflow Zapier). En Notion existe una "Database de Retrospectiva" — cada issue cerrado se etiqueta con su servicio asociado. Por ejemplo, los issues del proyecto `branding` se reportan bajo el servicio [Marca y Identidad de Marca](https://www.roibase.com.tr/es/branding). Estos datos alimentan la planificación de capacidad cada 3 meses: ¿cuánto tiempo de ingeniería se invirtió en cada servicio?

## Notion: Fuente de Verdad, No una Wiki

No usamos Notion como wiki — lo usamos como "registro de decisiones". Cada decisión estratégica (por ejemplo "¿server-side tracking o client-side en X campaña?") se escribe en Notion en formato **RFC (Request for Comments)**. La plantilla de RFC es:

```
## Decisión
[Una oración — qué hacemos]

## Contexto
[Por qué es necesario ahora]

## Alternativas
[Al menos 2 opciones + tabla de tradeoffs]

## Medición
[Cómo sabremos en 4 semanas si fue correcta]

## Propiedad
[Quién es responsable]
```

Cuando se abre un RFC, hay 48 horas de tiempo de comentario asincrónico. Nadie convoca reuniones — cada quien lee en su momento, deja comentarios. Después de 48 horas, el dueño de la decisión escribe la resolución final y el item se traslada a Linear.

**Capas de datos dentro de Notion:**
1. **Database de RFC** — todas las decisiones
2. **Database de Retrospectiva** — trabajos completados que vienen de Linear
3. **Playbook de Cliente** — notas operativas por cliente (dónde está qué dashboard, dónde están las claves API)
4. **Activos de Marca** — links a Figma, documento de tone-of-voice

Se quejan de que search en Notion no funciona, pero nosotros no buscamos — cada database está filtrada y etiquetada. La necesidad de search generalmente significa "pusiste los datos en el lugar equivocado".

## Slack: Async-First, Real-Time-Second

El sistema de notificaciones de Slack está desactivado en toda la organización. Solo `@channel` y `@here` están activos — con regla de uso: prohibido excepto por incidents P0. La mensajería se divide en 3 canales:

1. **#daily-digest:** Resúmenes de Linear/Notion, logs de deploy CI/CD
2. **#async-questions:** Preguntas donde no esperas respuesta inmediata (respuesta suficiente en 24 horas)
3. **#sync-now:** Coordinación en tiempo real necesaria (incident en producción, optimización de campaña en vivo)

**Expectativas de tiempo de respuesta:**
- `#sync-now` → 15 minutos
- `#async-questions` → 24 horas
- DM → 48 horas (no hay cultura de DM, se usan canales)

El uso de threads en Slack es obligatorio. Está prohibido responder directamente al canal — cada mensaje abre un thread. Así las conversaciones paralelas no se mezclan.

### Integración Slack → Granola

Granola es una herramienta de notas de reunión — pero en Roibase solo se usa en client calls. No hacemos reuniones internas (0-1 sync call por semana). Después de un client call, Granola envía el transcript IA al Slack, el equipo lo lee asincrónicamente. Los action items se transforman automáticamente en issues de Linear (trigger Zapier).

El killer feature de Granola: detecta compromisos numéricos en los transcripts y los destaca ("resultados A/B en 2 semanas", "CTR debe subir %15"). Estos reciben recordatorios automáticos — nadie olvida.

## Figma: No Handoff de Diseño, Spec Viviente

Figma no es solo herramienta de diseño — es la "capa de especificación frontend". Cada componente de UI está definido en Figma como variante. El developer no extrae código de Figma (no hacemos copy-paste de CSS) — pero lee el comportamiento del componente. Por ejemplo, los estados `hover`, `active`, `disabled` de un botón existen como frames en Figma. En el código se implementa la misma lógica de estado.

**Conexión Figma → Linear:**
Cada archivo Figma tiene el plugin `Linear Issue`. Cuando el diseño se aprueba, el designer abre directamente un issue de Linear, pega el link de Figma en la descripción. Cuando el developer toma el issue, ya conoce el diseño — implementa sin hacer preguntas.

Los comentarios de Figma no fluyen a Slack (para evitar bombardeo de notificaciones). En lugar de eso, existe un "Figma Digest" semanal — los comentarios abiertos se convierten en issues de Linear.

## Patrón de Integración: Dónde Viven los Datos

Las conversaciones sobre stack suelen empezar con "¿qué herramienta usas?" Pero la pregunta real debería ser "¿dónde es canonical el dato?" En Roibase, la propiedad de datos es así:

| Tipo de dato | Fuente de verdad | Se sincroniza a |
|---|---|---|
| Trabajo activo (WIP) | Linear | Digest diario Slack |
| Trabajo completado (retrospectiva) | Notion | Linear (archivado) |
| Decisiones estratégicas | Notion (RFC) | Linear (action items) |
| Notas de reunión con cliente | Granola | Thread Slack |
| Especificación de UI | Figma | Descripción de issue Linear |
| Activos de marca | Notion | Links embebidos en Figma |

No hay doble source-of-truth. Si un dato parece canonical en 2 lugares, uno está equivocado.

## Disciplina de Notificaciones: Cuándo Silencio, Cuándo Ruido

El riesgo más grande de un stack moderno es la cascada de notificaciones. La estrategia de notificaciones en Roibase es:

**Completamente desactivado:**
- Menciones en Linear (se usan threads en Slack en lugar de comentarios de issue)
- Comentarios de Figma (digest semanal)
- Actualizaciones de páginas en Notion (nadie hace watch)

**Como digest:**
- Resumen diario de Linear (09:00)
- Resumen de comentarios abiertos en Figma (viernes 17:00)
- Log de deploy CI/CD (resumen post-deploy a Slack)

**En tiempo real:**
- `@channel` (solo incident P0)
- Resumen de Granola post-call (dentro de 5 minutos del cierre)
- Error en producción (Sentry → Slack, solo al canal `#sync-now`)

Cuando se configura una herramienta, la primera pregunta es: "¿Esta notificación debe ser real-time o ir a un digest?" La respuesta por defecto es digest.

## Ahora Qué Hacer

En lugar del reflejo "adoptemos también esa herramienta", pregunta "¿dónde debe ser canonical este dato?" El stack 2026 de Roibase está construido sobre Linear/Notion/Slack/Figma/Granola, pero estas herramientas podrían cambiar — lo importante es el patrón de integración, la disciplina de notificaciones, la cultura async-first. Si tu equipo aún se queja de "la notificación de herramienta X no llega", el problema no es la herramienta — significa que la propiedad del dato no está clara.