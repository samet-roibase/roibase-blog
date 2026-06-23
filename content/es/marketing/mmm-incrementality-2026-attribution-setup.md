---
title: "MMM + Incrementality: El setup de Attribution de 2026"
description: "Robyn, Meta Lift y geo experiments — ¿qué método funciona cuándo? Guía técnica para reconstruir la atribución en la era post-cookie."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementality, attribution, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Last-click attribution murió en 2023, multi-touch attribution en 2024. En 2026, la medición de marketing se ha dividido en dos polos: Marketing Mix Modeling (MMM) a nivel macro, tests de incrementalidad a nivel micro. APIs de conversión server-side actúan como puente entre ambos. Este artículo explica cuándo funciona cada método, qué output alimenta qué decisión — no filosofía abstracta de atribución, sino un stack que puedes construir hoy en producción.

## Marketing Mix Modeling ahora corre semanalmente

MMM en 2015 significaba "presentación anual para el CEO". En 2026, herramientas abiertas como Robyn de Meta pueden ejecutarse cada semana, actualizando la contribución del canal. La estructura es así: el modelo ingiere datos históricos de gasto, impressiones, conversiones y factores externos (estacionalidad, días festivos, índice competitivo), los procesa mediante regresión de series temporales y extrae el ROAS marginal de cada canal. Si agregas 100.000 TL a un canal, ¿cuántas compras incrementales generarás? MMM responde esa pregunta.

La configuración no es trivial pero técnicamente transparente: necesitas como mínimo 52 semanas de datos diarios (idealmente 104 semanas), líneas de gasto atribuibles por canal, número de conversiones (mejor aún si tienes ingresos). Robyn funciona en Python y R, extrae datos de BigQuery o Snowflake, calcula la distribución posterior usando Prophet o Stan. El output es un gráfico de contribución por canal, curva de saturación y curva de respuesta — qué canal sufre por presupuesto excesivo, cuál ya está en el punto de retornos decrecientes.

La versión 2026 de Robyn añade granularidad a nivel geográfico: si divides Turquía en 7 regiones, calcula un threshold de saturación diferente para cada una. Estambul puede estar en 35% de saturación en Meta Ads mientras Anatolia está en 10% — ver esa diferencia cambia cómo reasignas presupuesto. Pero atención: MMM **no prueba causalidad**, muestra correlación. "El gasto en Google Ads subió y las ventas subieron" no es lo mismo que "Google Ads causó ese aumento en ventas". Aquí es donde incrementality cierra el hueco.

## Meta Lift resuelve incrementality dentro de la plataforma

El test de Conversion Lift de Meta es un randomized controlled trial (RCT) puro. Divide tu población en dos: muestra anuncios al grupo de prueba, nada al grupo de control. La diferencia en conversión entre ambos es la **contribución neta** de esa campaña. En 2026, este sistema bajó desde nivel de campaña hasta nivel de creative — puedes medir incrementality de forma independiente para 3 videos diferentes dentro de la misma campaña.

El setup técnico: en Ads Manager, en lugar de "Create A/B Test" seleccionas "Create Lift Test", con un mínimo de 200.000 reaches y duración de 2 semanas (Meta lo fuerza). Se recomienda que el grupo de control sea entre 10-20% — menos reduce potencia estadística, más implica pérdida de ingresos. Cuando termina el test, Meta te devuelve algo así: "Grupo de prueba: 1000 conversiones, grupo de control: 700 conversiones → 30% incremental lift, intervalo de confianza 18-42%".

Ese número se traduce directamente a presupuesto. Si la campaña gastó 100.000 TL y mostró 30% lift, significa que 30.000 TL de gasto generaron conversiones incrementales reales — los 70.000 TL restantes se hubieran convertido de todas formas a través de canales orgánicos u otros. De aquí calculas el costo marginal por conversión incremental (mCPIC): 100.000 / 300 = 333 TL. Comparas ese número con el output de MMM que dice "los últimos 1000 TL en Meta generaron 2.8 compras" — los dos números deben alinearse (diferencia de 15-20% es normal por variación metodológica), si hay 50%+ de divergencia tienes un problema de datos.

La limitación de Meta Lift: solo funciona dentro del ecosistema Meta, no mide efectos cross-channel. ¿Hay lift sinérgico cuando Google Ads + Meta funcionan juntos? Eso lo mide geo experiment.

## Geo experiments miden sinergia cross-channel

El framework de Geo Experiments de Google funciona así: divides Turquía en 10 regiones, aumentas gasto en 5 de ellas (o lo reducas a cero), dejas las otras 5 como está. Después de 4 semanas, comparas diferencia de ventas entre ambos grupos — si hay diferencia estadísticamente significativa (p<0.05), el cambio de gasto es la causa. La estructura es diferente a Meta Lift: no distingue por canal, solo mira el efecto total agregado a nivel regional.

En la práctica: en Campaign Manager 360 o Google Ads existe la opción "Experiments" > "Geo experiment" (desde 2026 también se puede desencadenar desde GA4). Defines regiones con código postal, estado o DMA (en Turquía, regiones NUTS2). Necesitas como mínimo 6 semanas de datos baseline, el test dura al menos 3 semanas (idealmente 6 para ahogar ruido estacional). El motor de inferencia Bayesiana de Google actualiza posterior cada día, al terminar devuelve algo como "aumento de 20% en gasto generó aumento de 8.5% en ventas (IC: 4.2-12.8%)".

Este método es particularmente poderoso para testear estrategias cross-canal. Por ejemplo: "¿Google + Meta juntos generan 15% más ventas que por separado?" Tomas un grupo A donde corres ambos canales a máxima capacidad, grupo B donde reduces Google en 50%. Si la diferencia de ventas es menor a 10%, significa sinergia débil, reasignas presupuesto. La desventaja de geo experiment: setup costoso (6 semanas baseline + 6 semanas test = 3 meses), los resultados solo importan cuando testeas cambios lo suficientemente grandes como para influenciar estrategia. Si intentas medir un tweak de 5%, se pierde en el ruido.

## Qué método cuándo — árbol de decisión

Puedes acotar tu decisión con 3 preguntas:

1. **¿Cuál es el scope de decisión?** Asignación anual de presupuesto → MMM. Comparación de creatives dentro de una campaña → Meta Lift. Test de sinergia cross-channel → Geo experiment.

2. **¿Está listo el piso de datos?** MMM requiere 52+ semanas de gasto limpio + datos de conversión. Lift requiere 200K+ reaches y 2 semanas. Geo requiere 6 semanas baseline + segmentación geográfica.

3. **¿Qué velocidad de decisión necesitas?** Optimización semanal → Meta Lift siempre abierto. Estrategia por trimestre → MMM refresh mensual. 1-2 pivotes grandes anuales → Geo experiment.

La tabla se ve así:

| Método | Output | Duración | Datos mínimos | Caso ideal |
|---|---|---|---|---|
| MMM (Robyn) | Contribución por canal, curva de saturación | 52+ semanas | Gasto + conversiones (diarios) | Estrategia de asignación de presupuesto |
| Meta Lift | Conversiones incrementales por campaña/creative | 2-4 semanas | 200K reaches | Testing de creative, poda de campañas |
| Geo Experiment | Sinergia cross-channel, lift regional | 6-12 semanas | 6 semanas baseline + datos regionales | Test de sinergia de canales, expansión regional |

Estos tres métodos no son alternativos, son complementarios. MMM dice "qué canal vale cuánto", Lift dice "esta campaña realmente generó valor", Geo dice "¿dos canales juntos son mejores?" Los equipos que operan los tres basan la estrategia de [Publicidad Performance](https://www.roibase.com.tr/es/ppc) en experimentos, no en hipótesis.

## Construir el stack en producción

Para traducir el framework teórico a práctica, necesitas estas capas:

**Recolección de datos:** Usa server-side GTM para enviar señales de conversión en paralelo a Google Ads, Meta CAPI y BigQuery. Si confías solo en cookies del lado del cliente, pierdes 30-40% de señales (iOS 17, Firefox, Brave). La infraestructura de [Marketing Digital](https://www.roibase.com.tr/es/dijitalpazarlama) de Roibase combina sGTM + data layer first-party — de aquí salen los datos granulares de gasto que MMM necesita.

**Pipeline de modelo:** Alimenta Robyn desde BigQuery. Usa dbt para modelar gasto + conversiones a granularidad diaria. Que un script Python se ejecute semanalmente (Cloud Function o Airflow), y envíe output a Looker Studio. Inicia tests de Lift desde Ads Manager manualmente pero extrae resultados vía API (el endpoint `insights` de Marketing API devuelve las métricas de lift), escribe en BigQuery e haz join con output de MMM.

**Geo experiment:** El API de Google Ads soporta setup programático del resource `experiments`. Cuando el test termina, extrae resultados con `experiment_id`, escribe en BigQuery y compara con conclusiones de MMM. Verlo todo en un dashboard es muy valioso: "MMM dice contribución Meta 22%, Lift test dice incremental 28%, Geo test dice varianza regional 12-34%" — esos 3 números juntos resuelven la decisión.

**Loop de decisión:** Cada trimestre refresh de MMM, 1-2 tests de Lift mensuales, 1 geo experiment cada 6 meses. Para equipos pequeños, si este tempo parece excesivo, primero construye MMM (2 semanas si tienes datos limpios), luego haz Meta Lift rutina (agrega a cada campaña por default), usa Geo solo antes de grandes pivots.

En 2026, attribution no es una herramienta, es orquestación de tres. Cada una responde una pregunta diferente, juntas hacen la decisión posible en realidad post-cookie. Test en lugar de hipótesis, causalidad en lugar de correlación, resultados de experimento en lugar de dashboard — crecimiento se construye sobre esa base.