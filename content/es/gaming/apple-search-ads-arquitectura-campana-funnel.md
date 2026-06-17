---
title: "Apple Search Ads: Construir la Arquitectura de Campaña como Funnel"
description: "Flujo de presupuesto desde Discovery a Brand: cómo estructurar campañas broad match, competitor y exact como capas jerárquicas — arquitectura ASA."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, arquitectura-campana-asa, adquisicion-usuarios-mobile, estrategia-funnel-app, brand-defense]
readingTime: 8
author: Roibase
---

Estructurar campañas de Apple Search Ads no como silos aislados, sino como capas de funnel que transfieren presupuesto y señales entre sí, puede reducir el CPP entre 20-40% en growth de mobile games. La señal de usuario capturada en broad match de Discovery fluye hacia competitor exact, luego hacia brand defense — cada capa filtra a la siguiente. Después de iOS 18.2 en 2026, los datos de atribución de custom product page hacen obligatoria esta arquitectura: el enfoque single campaign oculta churn, la distribución de presupuesto permanece excesivamente manual.

## Capa Discovery: Por Qué Broad Match Debe Estar en la Parte Superior

Las campañas de broad match son la capa discovery en la jerarquía de Apple Search Ads — existen para descubrir nuevos clusters de keywords, capturar señales de intent inesperadas. Pero la mayoría de estudios mantienen este modo abierto con mentalidad "prueba todo, filtra después", quemando 500-1000 dólares diarios con TTR (Tap-Through Rate) por debajo del 2.5%. El enfoque correcto: colocar broad match en la capa superior del funnel, pero controlar el umbral de CPP con una **rolling window de 3 días**.

En una campaña broad, el objetivo no es CPP, sino **ratio LTV/CPI** — un ratio de 0.4x en los primeros 3 días es aceptable, porque esos datos van al data warehouse. El valor de esa información está aquí: el algoritmo Search Match te permite ver el competitive set de tu juego desde la perspectiva de Apple. Cuando lanzas broad match con "puzzle game", el algoritmo expone clusters de intent como "merge", "match-3", "interior design" — estos se convierten en candidatos para migración a la campaña competitor exact.

Ajuste crítico: en la campaña broad, **NO incluyas negatives exactas**. Las keywords negativas solo deben aplicarse a categorías irrelevantes (por ejemplo, "poker" si tu género de juego es diferente). Poner negatives exactas corta el loop de aprendizaje del algoritmo, mata la función de discovery.

### Fórmula de Techo de Presupuesto para Broad Match

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → cuota discovery (%15)
# 1.8 → multiplicador CPI broad (aceptable en 1.8x del exact)
```

Ejemplo: objetivo mensual 10K installs, target CPI $2.5 → presupuesto broad $6,750/mes → ~$225 diarios. Si excedes este techo, broad se convierte en desperdicio, no en discovery.

## Competitor Exact: Capa de Intent Hijacking

Dentro de los keywords que emerge de broad match, si encuentras **nombres de juegos rivales** y **terms de marca rival**, deben migrarse a la segunda capa — campaña competitor exact. La lógica es simple: hijackear la awareness de brand del rival. Un usuario busca "Candy Crush", tú muestras tu puzzle game — el intent ya está educado, solo ofreces una alternativa.

El TTR de competitor exact es 30-50% más bajo que brand exact (datos propios de Apple), pero el CPP típicamente es 15-25% más barato porque hay menos competencia bid en la keyword del rival. Lo importante: la estrategia de custom product page cambia en competitor. Si el rival es un juego de "time management", tu creative en CPP debe comunicar "menos tiempo de espera" — sin este posicionamiento diferencial, el ROI de competitor exact se vuelve negativo.

El error en selección de keywords competitor: tomar los top-20 del ranking de top-grossing. El método correcto: **análisis de audience overlap** — extraer demographics de usuarios del rival desde Sensor Tower o data.ai, seleccionar aquellos con 60%+ overlap con los tuyos. Si tienes un hyper-casual, tomar keywords de match-3 legend es desperdicio — las motivaciones core del audience son diferentes.

| Tipo de Competitor | TTR Benchmark | CPP vs Brand Delta | Uso de CPP |
|---|---|---|---|
| Competidor directo (mismo subgénero) | 3.5-5% | +%15-20 | Sí, alta prioridad |
| Género adyacente (loop core similar) | 2.8-4% | +%25-35 | Sí, testea |
| Líder de categoría (mecánicas distintas) | 1.5-2.5% | +%50+ | No, riesgo de waste |

## Brand Defense: Por Qué Proteger Tu Nombre Requiere Campaña Separada

La campaña brand exact — tu nombre de juego, nombre del studio — es la capa inferior del funnel y el **layer de conversión más barato**. En Apple Search Ads, el CPT (Cost Per Tap) para brand típicamente es $0.10-0.30, mientras que broad match está en $1.5-3. Sin embargo, muchos estudios saltan brand porque piensan "los usuarios que ya nos buscan descargan orgánico" — esto significa perder 12-18% de installs.

¿Por qué? Porque los rivales también hacen bid en tu brand keyword. Eres dueño de "Puzzle Master", pero un rival con "Match Kingdom" hace bid en tu brand search por $2. El algoritmo de auction de Apple combina relevancia + bid — si no ofertas, a veces pierde tu rival. Brand defense campaign existe para prevenir este hijack.

En campaña brand, TTR está entre 18-35% — muy alto, porque el intent es definitivo. Lo que debes hacer en esta capa: **exact match only**, bid de $0.5-1 (suficiente para outbid a rivales), y el creative de CPP debe ser "nueva temporada" o "actualización" — necesitas dar una razón fresca a quien ya conoce el juego.

### Estrategia de Bid para Campaña Brand

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Supera al rival
else:
    brand_bid = 0.3  # Bid mínimo, blend orgánico + paid
```

En campaña brand, **Search Match debe estar desactivado** — el algoritmo a veces expande brand terms a keywords no relacionados, creando leaks de presupuesto.

## Flujo de Presupuesto Entre Capas: Arquitectura Waterfall

Gestionar tres capas con presupuestos aislados vs. establecer una **asignación de presupuesto waterfall** aumenta ROAS 25-40%. La lógica: cada capa funded hasta umbral de performance, el overflow sube a la capa siguiente — así equilibras investment en discovery con conversión efficiency.

Reglas waterfall:
1. **Brand exact siempre completamente financiado** — si ROI es positivo, sin límite presupuestario
2. **Competitor exact → feed a brand** — si LTV/CPI > 1.2, overflow va a testing de nuevos keywords competitor, no a brand
3. **Broad match → cap presupuestario 15%** — nunca más del 15% del presupuesto ASA total a broad, sino el funnel es top-heavy

Con Apple Search Ads API puedes automatizar esto (v5.0 de 2026 tiene endpoint budget adjustment):

```json
{
  "campaignId": 123456,
  "budgetAdjustment": {
    "type": "waterfall",
    "source": "competitor_exact",
    "condition": "LTV_CPI > 1.5",
    "action": "reallocate_to_brand",
    "amount": "overflow"
  }
}
```

Ejecutar este endpoint diariamente con BigQuery + Airflow automatiza el flujo presupuestario. Sin esto, los ajustes manuales cada 3 días reaccionan lentamente, causando opportunity loss de 8-12%.

## Estrategia de Negative Keywords: Prevenir Salpicaduras Entre Capas

Cuando corres broad, competitor y brand como campañas separadas, hay **riesgo de keyword overlap** — el mismo search term activa las tres, compitiendo contigo mismo en bid. El auction de Apple no muestra múltiples campañas del mismo advertiser, pero causa waste: el bid más alto gana, los otros pierden impression pero reservan presupuesto.

Solución: **cross-campaign negative sync**. Así:
- Cada keyword en brand exact → negative exact en competitor exact
- Cada keyword en competitor exact → negative phrase en broad match
- Keyword de broad que convierte → después 14 días, migra a competitor o brand, agrega negative a broad

Esta sincronización no puede hacerse manualmente (40 horas/semana en account de 2000+ keywords). Script Python o herramienta de ASA automation es obligatorio:

```python
# Pseudo-código
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Sin negative sync, el CPI promedio sube 18-25% — no es waste sino ineficiencia. El costo de intentar alcanzar al mismo usuario desde tres campañas diferentes.

## Trampa de Attribution en Arquitectura Funnel

Apple Search Ads tiene ventana de attribution de 30 días — si el usuario toca el ad y descarga dentro de 30 días, se atribuye a esa campaña. Pero **la realidad multi-touch**: usuario vio broad match, no descargó; 5 días después buscó en brand exact, descargó — attribution va a brand, la contribución de broad desaparece. Esta situación crea tendencia a cortar presupuesto broad, matando discovery.

Solución: **attribution modeling asistida**. Extraer impression + tap data del API de Apple Search Ads, armar modelo multi-touch attribution en BigQuery. Con Markov chain o Shapley value, asignas contribución a cada campaña. Ejemplo finding: broad match en 30 días generó 120 installs directos pero contribuyó a 840 conversiones asistidas — valor real es 7x.

```sql
-- Ejemplo multi-touch en BigQuery
WITH touch_chain AS (
  SELECT user_id, campaign_type, timestamp,
    LEAD(campaign_type) OVER (PARTITION BY user_id ORDER BY timestamp) as next_touch
  FROM asa_events
)
SELECT campaign_type, COUNT(*) as assisted_conversions
FROM touch_chain
WHERE next_touch = 'brand_exact'
GROUP BY campaign_type;
```

Sin estos datos, broad parece "caro e ineficiente" y se corta — el funnel colapsa.

## Mantener Viva la Arquitectura de Campaña

La arquitectura funnel de Apple Search Ads no es estática — nuevos keywords cada semana, landscape competitivo cada mes, trends de género cada trimestre. Para mantenerla viva se necesita **ciclo de review de 3 semanas**:

1. **Semana 1-2:** Search Match report de broad → discovery de nuevos keyword clusters
2. **Semana 3:** Datos de performance keyword → seleccionar migration candidates a competitor exact
3. **Semana 4:** Control de hijack de brand keyword → monitoreo de activity bid rival

El reporting manual en Apple Search Ads Console no es suficiente — necesitas daily pull via API + dashboard en Looker Studio. En clientes de mobile gaming de Roibase, este dashboard expone en tiempo real: TTR por funnel stage, % de keyword overlap cross-campaign, assisted conversion rate, LTV/CPI por capa.

Ejecutar la arquitectura funnel con esta disciplina convierte Apple Search Ads en tu canal UA más importante — CPP controlado, LTV visible, scale predecible. Discovery, competitor, brand — cada capa alimenta a la siguiente con señal y presupuesto, en lugar de kampanye aisladas construyes un ecosistema. A medida que iOS privacy se tightens en 2026, esta arquitectura no es lujo sino necesidad — jugar en la propia plataforma de Apple, con su atribución, su auction, es el canal de growth más estable post-IDFA.