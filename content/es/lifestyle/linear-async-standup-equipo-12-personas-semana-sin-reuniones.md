---
title: "Linear + Async Standup: Equipo de 12 Personas, Semana Sin Reuniones"
description: "Gestión de ciclos, disciplina de updates diarios y escalado de bloqueos. Cómo reducimos reuniones síncronas a cero en un equipo de 12 personas."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: lifestyle
i18nKey: lifestyle-001-2026-07
tags: [linear, async-standup, gestion-ciclos, workflow-equipo, equipo-remoto]
readingTime: 8
author: Roibase
---

Cuando el equipo de Roibase alcanzó 12 personas, el standup matutino de 15 minutos significaba 180 minutos semanales de tiempo en equipo. Sumando el costo del context switching, la pérdida real superaba 300+ minutos. En Q4 2023 pasamos al modelo async: patrón de ciclos en Linear + updates escritos diarios. Dos trimestres después, las reuniones semanales bajaron de 5 a 0. La velocidad subió 23%, el tiempo de resolución de bloqueos pasó de 18 horas a 4. Este artículo detalla cómo lo hicimos.

## Patrón de Ciclos en Linear: Ingeniería de un Ritmo de Dos Semanas

La estructura de ciclos en Linear no es una versión ligera del sistema de sprints — redefinía la unidad atómica de trabajo. En Roibase, cada ciclo es de 10 días hábiles: apertura el lunes, cierre el viernes de la segunda semana. El scope del ciclo se congela en la fase de commitment, sin cambios. Este marco rígido elimina la ansiedad de planificación.

Al inicio del ciclo definimos 3-5 objetivos principales a nivel "Initiative". Cada initiative se abre como issue padre en Linear, con 8-12 tareas atómicas debajo. La definición de tareas sigue las reglas INVEST: Independent, Negotiable, Valuable, Estimable, Small, Testable. Si una tarea no cierra en un día, la dividimos. Esta granularidad hace que los updates diarios sean significativos — en lugar de "continuamos con el diseño de UI", podemos decir "completamos el selector de método de pago en el flujo de checkout".

El criterio de cierre del ciclo es: 85% del issue padre en estado done. El restante 15% se traslada automáticamente al siguiente ciclo. Este buffer previene el overcommitment. Datos de 2025 H2: en 11 ciclos, 9 alcanzaron +92% de completion rate. El gráfico de burn-down en Linear analytics se revisa diariamente — si la tendencia es mala, hacemos ajustes de scope a mitad del ciclo.

## Protocolo de Updates Async: Disciplina de Thread en Slack + Comentarios en Linear

El formato de updates diarios fue estandarizado. Cada mañana antes de las 10:00, cada persona abre un thread en el canal `#daily-updates`. El formato es:

```
Ayer: [Linear #1234] Integración con gateway de pagos — 80% completado
Hoy: [Linear #1234] Manejo de errores + cobertura de tests
Bloqueador: Webhook de Stripe en modo test devuelve 403
```

El número del issue en Linear es obligatorio. No hay copiar-pegar — el update se publica también como comentario en el issue. Esta disciplina de doble escritura mantiene el historial del issue autónomo. Tres meses después, revisas la tarea y entiendes qué pasó sin necesidad de leer threads antiguos.

La definición de bloqueador es crítica: si no puedes avanzar sin input de otra persona del equipo, es bloqueador. Una pregunta técnica no es bloqueador — va a documentación o al canal de preguntas async. Reportar un bloqueador dispara cambio de asignación o pair session en máximo 4 horas. Datos de 2025 Q4: 47 casos de bloqueador, resolución promedio 3.8 horas. En el modelo anterior (mencionar en standup, luego coordinar), eran 18 horas.

El costo social de la disciplina de updates es cero — no hay "buenos días" ni small talk. El thread cierra automáticamente a las 10:00 (workflow de Slack). Los updates después de esa hora van por DM al PM, se registran como violación de regla. En 6 meses, 3 violaciones = item en revisión de desempeño.

## Patrón de Escalado de Bloqueadores: 30 Minutos — 4 Horas — 24 Horas

Si no resuelves un bloqueador en 30 minutos, lo escribes en el thread de Slack. Si no hay respuesta en 4 horas, añades el label `urgent` al issue en Linear y mencionas al PM. El PM habla directamente con el dueño del bloqueador — nunca sugiere "programemos una reunión". Si no se resuelve en 24 horas, el issue se saca del scope del ciclo y va automáticamente al backlog.

El patrón de escalado es medible. Linear automation envía cada evento de label `urgent` a BigQuery. El reporte semanal muestra el tiempo de resolución por nivel de equipo. Si el promedio del equipo supera 4 horas, es item de retrospectiva. Este mecanismo elimina la presión social — no reportar un bloqueador es más caro (el ciclo falla) que reportarlo.

La retrospectiva también es async. Después de cerrar el ciclo, el issue `retro-{ciclo}` está abierto 48 horas. Cada persona añade comentarios. Pasadas las 48 horas, el PM resume y los action items van al scope del siguiente ciclo. En 24 ciclos (2024-2025), ninguna retrospectiva requirió reunión síncrona.

## Integración de Herramientas: Linear ↔ Figma ↔ GitHub ↔ Slack

El modelo async no funciona sin integración de herramientas. La configuración de Roibase:

- **Linear ↔ GitHub:** Si escribes `Fixes LIN-1234` en la descripción de un PR, el issue cambia de estado automáticamente. Cuando se aprueba el review, pasa a `in-review`. Al hacer merge, va a `done`.
- **Linear ↔ Figma:** Los issues de diseño requieren URL del archivo Figma como campo obligatorio. Los comentarios en Figma se reflejan en la actividad del issue mediante webhook.
- **Linear ↔ Slack:** Cada cambio de estado se envía al canal `#dev-activity`. Pero sin notificaciones — el canal es solo para auditoría, nadie lo sigue activamente.

La integración de herramientas responde la pregunta "quién qué está haciendo" sin necesidad de preguntar. El tablero de Linear es el estado real del proyecto en tiempo real. Los líderes de equipo abren Linear por la mañana con el café, ven en 2 minutos cuáles ciclos están en riesgo. Los standups existían para "actualizar estado" — ahora el estado es visible.

¿Desaparece toda comunicación síncrona? No. Una vez a la semana hay "office hours": dos horas donde todos reservan disponibilidad para pair programming o discusión de diseño. Pero es opcional. Datos de 2026 H1: en un equipo de 12 personas, promedio 4.2 pair sessions semanales. 20 minutos por persona. Eso es el 15% de la carga de reuniones del modelo anterior.

## Impacto en Recruitment: Modelo Async Como Filtro

El modelo Linear + async se convirtió en filtro de contratación. El proceso de selección en Roibase incluye un "take-home task": el candidato se añade al tablero de Linear por 3 días. Tarea: completar un issue padre con 5 sub-tareas, hacer updates diarios, simular un bloqueador y escalarlo. La calidad de comunicación escrita, la granularidad en definición de tareas y la gestión del tiempo se ven claramente.

En los últimos 18 meses contratamos 8 personas. Todas pasaron esta prueba. 2 candidatos fueron descartados durante el proceso — no pudieron mantener la disciplina de updates diarios. En equipos que valorizan la [marca](https://www.roibase.com.tr/es/branding) como Roibase, el alineamiento cultural representa el 60% del éxito operacional. El modelo async transparenta la voz del equipo, elimina expectativas vagas.

La cultura async también impacta la retención. Horarios de trabajo flexible son reales: la gente puede trabajar a las 06:00 o a las 22:00, siempre que cumpla la disciplina diaria. El tenure promedio en Roibase es 3.4 años — el promedio en equipos tech en Türkiye es 1.8 años. El modelo async tiene un rol directo aquí.

## Métricas de Ciclos: Aquello Que Mides, Se Transforma

El tablero de Linear no es solo un tracker de tareas — es la interfaz de dashboarding del desempeño del equipo. Al cierre de cada ciclo, Roibase revisa 4 métricas:

1. **Completion rate:** Issues en done / total de issues. Meta: >85%.
2. **Cycle variance:** Issues sacados del scope. Meta: <3.
3. **Bloqueadores:** Cantidad de labels `urgent` + tiempo promedio de resolución. Meta: <5 bloqueadores, <4 horas.
4. **Cumplimiento de updates:** Updates que perdieron el deadline de 10:00. Meta: 0.

Estas métricas van a la retrospectiva. No se usan para evaluación individual — el objetivo es optimizar el sistema. Por ejemplo, en 2025 Q3 el tiempo de resolución de bloqueadores subió a 6 horas. Root cause: el PM había reducido los slots de pair sessions. Corrección: se aumentó de 3 a 5 horas semanales, el tiempo bajó a 3.5 horas.

La cultura orientada a métricas genera confianza. "¿Por qué trabajamos sin reuniones?" tiene respuesta en números: aumento de velocidad, rapidez en bloqueos, consistencia en completitud. El modelo async no es una preferencia subjetiva, es una ventaja operacional medida.

---

En Roibase, el modelo async es la norma. Cuando un nuevo miembro se incorpora, aprende el patrón de ciclos en Linear el primer día, escribe su primer update el tercer día. A los seis meses, alguien escribe en un thread de retrospectiva: "en mi equipo anterior pasaba 3 horas diarias en reuniones". Linear + standup async es al principio una elección de herramientas — luego se convierte en la columna vertebral de la disciplina del equipo. Si un equipo de 12 personas sostiene una semana sin reuniones, cuando crece la importancia de este modelo solo aumenta.