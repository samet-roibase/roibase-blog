---
title: "Contratación Async-First: Filtros Prácticos y Estructura de Entrevista"
description: "Semana de prueba, evaluación escrita y eliminar el sesgo sincrónico — diseño de contratación medible para construir equipos remotos."
publishedAt: 2026-05-18
modifiedAt: 2026-05-18
category: lifestyle
i18nKey: lifestyle-005-2026-05
tags: [async-first, remote-hiring, trial-week, written-assessment, team-culture]
readingTime: 8
author: Roibase
---

Si quieres construir un equipo async-first, debes diseñar el proceso de contratación también de forma asincrónica. El enfoque "cerremos en 3 rondas para decidir rápido" es un residuo de la cultura sincrónica — al final, estás contratando a alguien que habla bien en una videoconferencia abarrotada pero no puede articular ideas por escrito. En Roibase, desde 2018 contratamos desarrolladores, analistas y estrategas fuera de Estambul. Nuestro proceso: evaluación escrita, semana de prueba, criterios de decisión documentados. En este artículo desglosamos la mecánica del hiring async-first.

## Identifica el sesgo sincrónico en las entrevistas tradicionales

El formato de entrevista clásico recompensa la comunicación sincrónica. El perfil que responde rápido, que muestra carisma, que mantiene contacto visual, recibe puntuaciones altas. Pero en un equipo async, estas habilidades no son críticas. La verdadera competencia es escribir análisis detallados en un issue de Linear, responder 3 horas después sin perder contexto, convertir la ambigüedad en documentación.

En Roibase hicimos un experimento en 2020: contratamos dos perfiles de desarrollador. El primero ofrecía explicaciones perfectas en video call, el segundo mostraba pausas en el habla pero presentaba el diseño de la solución de manera nítida en una evaluación escrita de 2 páginas. Contratamos al segundo. 8 meses después, su velocidad de resolución de issues en Linear fue 34% más alta — cumplió las expectativas.

Si permites lo sincrónico en la contratación, creas dependencia sincrónica en el equipo. Para un equipo async-first, el mecanismo de filtro también debe ser async.

## Evaluación escrita: muestra cómo tomas decisiones

El primer paso concreto del hiring async es la evaluación escrita en lugar del CV. Haz 2-3 preguntas al candidato, dale 48 horas, espera 400-600 palabras. Ejemplos de preguntas: "¿Has experimentado conflictos de dependencia en tu último proyecto? Describe el proceso de solución" o "¿Cómo resuelves conflictos de opinión en equipo? Usa un escenario real".

**Criterios de evaluación:**
- Estructura: ¿tiene secciones claras de introducción, análisis y conclusión?
- Detalle: ¿menciona números concretos, nombres de herramientas, rangos de tiempo?
- Contexto: ¿puede alguien más entenderlo al leerlo?
- Tono: ¿es explicativo en lugar de defensivo?

En esta fase eliminamos el 60%. Los candidatos que tardan más de 3 días, envían respuestas de un párrafo o se esconden detrás de jerga quedan fuera. La disciplina de escritura es un requisito previo en la cultura async-first — probarlo antes de la semana de prueba reduce costos.

### Tiempo de respuesta: no velocidad, sino priorización

Responder dentro de 48 horas simula el trabajo async. El candidato puede estar en un trabajo full-time, puede estar en una zona horaria diferente. Lo importante no es la velocidad sino la respuesta sistemática. Preferimos a alguien que envía media respuesta en 24 horas versus una propuesta que llega en 40 horas pero está bien analizada.

## Semana de prueba: trabajo real a cambio de pago

La semana de prueba es el filtro más crítico para construir un equipo async. El candidato tiene acceso durante 5 días a las herramientas que usa el equipo: Linear, Notion, Figma, GitHub. Le asignas un task real — no es una simulación de proyecto, es un issue del backlog actual con prioridad baja. Al final, se le paga: tarifa diaria × 5 días.

**Criterios de la semana de prueba:**
- Calidad de resolución del issue (%40 ponderación)
- Compartir contexto en comentarios de Linear (%30)
- Cómo pidió ayuda cuando se atascó — ¿un documento async o pánico en Slack? (%20)
- Time-to-first-response: ¿cuándo llegó el primer commit? (%10)

En 2023, una candidata a analista de datos completó una semana de prueba diseñando un dashboard. Documentó su query de BigQuery en Notion, explicó sus supuestos, identificó datos faltantes temprano. El primer commit llegó 18 horas después (expectativa: 24 horas). La contratamos. 6 meses después, el costo de setup del proyecto fue 40% menor — porque la disciplina de documentación estuvo ahí desde el día uno.

Hacer la semana de prueba sin pago es tanto un problema ético como un filtro incorrecto. Cuando pagas por el task, la gestión del tiempo del candidato es más realista.

## Video call sincrónico: no para decidir, sino para presentar la cultura

En el hiring async-first no está prohibido hacer una entrevista sincrónica — pero **no para tomar decisiones**. Usa la videollamada de 30 minutos para: presentar la cultura del equipo, aclarar expectativas async, permitir que el candidato haga preguntas.

La única pregunta que hacemos en la call es: "¿Qué quedó sin claridad durante la semana de prueba?" Evaluamos el estilo de comunicación async a través de la respuesta. Si dice "¿por qué hiciste así?" en lugar de "me faltó contexto en ese punto del documento", eso indica baja compatibilidad con equipos async.

Algunos candidatos llegan esperando una entrevista estilo Zoom — ese es el momento para transmitir la filosofía async. "Aquí una code review puede tardar 3 horas, si no hay urgencia 24 horas. ¿Te va bien así?" Eliminar temprano a quien no se adapta ahorra tiempo.

## Decisión: puntuación en documento, aprobación sin reunión

Cuando termina la semana de prueba, el proceso de decisión también es async. Cada persona del equipo puntúa desde el issue de Linear: criterios en escala 1-5. En Notion va el documento de decisión: tabla de puntuaciones, comentarios del equipo, recomendación final. El hiring lead cierra el documento y pide aprobación en Slack. Si no hay objeciones en 48 horas, se contrata.

**Ejemplo tabla de puntuación:**

| Criterio | Ponderación | Puntos (1-5) | Explicación |
|----------|-------------|--------------|------------|
| Resolución de issue | 40% | 4 | Código limpio, coverage bajo |
| Comunicación async | 30% | 5 | Comentarios en Linear detallados |
| Compartir contexto | 20% | 4 | Falta un commit message |
| Time-to-response | 10% | 5 | Primer PR llegó en 16 horas |

Esta tabla elimina la necesidad de una videollamada. No usas "lo que sentí" sino "lo que documenté". La decisión cierra en 2 días — sin reunión sincrónica.

## Mecanismo de objeción: transparencia en el documento

La decisión de contratación está abierta en Notion (candidato anonimizado). Si alguien del equipo objeta, rellena la sección "contra-argumento": en qué criterio difiere su evaluación, en qué punto de datos se basa. El hiring lead responde en 24 horas. Las objeciones rondan el 15% — muchas veces aportan un punto de vista nuevo que cambia la conversación.

Este mecanismo refuerza la cultura async. El equipo confía en los documentos, las decisiones son transparentes. Se bloquea el estilo "yo lo resuelvo" del founder o lead. En agencias boutique como Roibase, cuando crece el equipo, esta disciplina se refleja en cómo se comunica la [marca](https://www.roibase.com.tr/es/branding) hacia afuera — el mensaje "así trabajamos" llega al exterior.

## Costo del hiring async: ahorra tiempo realmente

A primera vista, el hiring async parece más lento — evaluación escrita 2 días, semana de prueba 5 días. Pero el costo de una mala contratación es 3-6 meses. El filtro async elimina perfiles incompatibles en fases tempranas. Contratar a alguien que se vio bien en una entrevista sincrónica pero no encaja en la cultura async, y descubrirlo en el mes 2, es más caro.

En Roibase, en los últimos 3 años contratamos 12 personas con hiring async. La tasa de rotación en los primeros 6 meses fue del 8% — el promedio de la industria es 25%. La razón: la semana de prueba es una simulación de trabajo real, el filtro ocurre temprano. Forzar lo sincrónico para ahorrar tiempo es tentador a corto plazo — destruye la cultura del equipo a largo plazo.

Si quieres construir un equipo async-first, el proceso de contratación debe ser async. Semana de prueba, evaluación escrita, decisión documentada: estos son pasos mecánicos. Las videollamadas son posibles pero las decisiones no se toman ahí. La disciplina del hiring async establece expectativas claras desde el día uno del equipo.