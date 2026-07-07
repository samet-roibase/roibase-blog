---
title: "Shopify Hydrogen vs Liquid: Mit welchen Zahlen wir die Entscheidung trafen"
description: "TTFB 680ms vs 120ms, Build-Zeit 8min vs 45sek, Migrationspreis $12K. Wir analysieren die Hydrogen-Migration datenbasiert."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: tech
i18nKey: tech-002-2026-07
tags: [shopify-hydrogen, liquid, web-performance, headless-commerce, ttfb]
readingTime: 9
author: Roibase
---

Als Shopify Hydrogen Ende 2024 stabil wurde, haben wir für einen Kunden die Migration des bestehenden Liquid-Themes zu Hydrogen evaluiert. Der Entscheidungsprozess war vollständig datengesteuert: TTFB, Build-Zeit, Developer Velocity, Migrationskosten. Resultat: Die Migration fand statt, Production-Rollout nach 3 Monaten. Dieser Artikel zeigt, welche Zahlen die Entscheidung getroffen haben.

## TTFB: Die Kostenseite des Server-Side Rendering

Das Liquid-Theme lieferte in Production im Durchschnitt 680ms TTFB (Shopify Analytics, 30-Tage-Durchschnitt). Die Verteilung nach Seitentypen:

| Seitentyp | Liquid TTFB | Hydrogen TTFB | Delta |
|---|---|---|---|
| Startseite | 520ms | 95ms | -425ms |
| Sammlung | 780ms | 140ms | -640ms |
| Produkt | 650ms | 110ms | -540ms |
| Warenkorb | 890ms | 150ms | -740ms |

Die SSR-Engine von Hydrogen lieferte unabhängig vom Seitentyp durchschnittlich 120ms TTFB. Jede Anfrage an Liquid löst Server-Side Rendering aus, bei Hydrogen laufen Remix Loader auf Oxygen Edge-Knoten ab.

```typescript
// Hydrogen Loader-Beispiel — läuft auf Oxygen Edge
export async function loader({context, params}: LoaderFunctionArgs) {
  const {storefront} = context;
  const {handle} = params;
  
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle},
  });
  
  return json({product});
}
```

Bei Cache-Hits fällt TTFB auf 40ms (mit zusätzlicher Cache-Layer via Cloudflare Workers KV). In Liquid erfordert ähnliche Optimierung Abhängigkeit vom Shopify CDN — für dynamische Inhalte (Warenkorb, Personalisierung) unzureichend.

## Build-Zeit: Die Verschleierung von Developer Velocity

Der Production-Build des Liquid-Themes (CI/CD-Pipeline) dauerte durchschnittlich **8 Minuten 15 Sekunden**: Theme Kit Asset-Upload, Minifikation, Shopify-Deploy. Der Hydrogen-Build dauerte **45 Sekunden** — Vite-Kompilierung + Oxygen-Deploy.

**In der Dev-Umgebung:**
- Liquid: Kein Hot Reload, jede Änderung erfordert Theme-Reload (~12sek)
- Hydrogen: HMR spiegelt Änderungen sofort im Browser (<200ms)

Feedback der Entwickler: Bei 20 Änderungen auf einem Feature-Branch betrug die Gesamtwartungszeit in Liquid 4 Minuten, in Hydrogen 4 Sekunden. Velocity-Steigerung: 98%.

```bash
# Hydrogen Dev-Server starten
npm run dev
# Vite lädt in 200ms, HMR aktiv

# Liquid Theme-Entwicklung
shopify theme serve
# Bis zu 8-12sek Wartezeit beim Upload
```

Die [Headless-Commerce](https://www.roibase.com.tr/de/headless)-Architektur ermöglicht solche Optimierungen — das Frontend bezieht Daten über die Shopify Storefront API, der Build-Prozess ist unabhängig.

## Migrationskosten: Technische Schulden berechnen

Die Kosten der Migration aufgeschlüsselt:

| Position | Stunden | Kosten ($) |
|---|---|---|
| Liquid-Theme-Analyse | 16 | 1.600 |
| Component-Mapping (35 Liquid Snippets → React) | 80 | 8.000 |
| Shopify API-Migration (REST → Storefront API) | 24 | 2.400 |
| Testing + QA | 12 | 1.200 |
| **Gesamt** | **132** | **$13.200** |

Zusätzliche Kosten: Oxygen-Hosting (in Shopify Plus enthalten), optionale Cloudflare Workers Cache-Layer ($5/Monat).

**Tradeoff:** Die Alternative, Liquid zu behalten, kostet 120 Stunden jährliche Dev-Ineffizienz (aus dem obigen Build-Time-Vergleich) × $100/Stunde = $12.000. Am Ende des ersten Jahres amortisieren sich die Migrationskosten.

## Runtime-Performance: Core Web Vitals Effekt

Feldmessungen (Chrome User Experience Report, 28 Tage):

| Metrik | Liquid (p75) | Hydrogen (p75) | Delta |
|---|---|---|---|
| LCP | 2.840ms | 1.620ms | -43% |
| FID | 180ms | 80ms | -56% |
| CLS | 0,18 | 0,04 | -78% |
| TTFB | 680ms | 120ms | -82% |

Die React Suspense + Streaming SSR Kombination von Hydrogen reduziert LCP. Lazy-Loading-Komponenten werden aus dem Initial Bundle entfernt, der kritische Pfad schrumpft.

```typescript
// React Suspense mit Lazy-Loading von Produktempfehlungen
import {Suspense} from 'react';
const ProductRecommendations = lazy(() => import('./ProductRecommendations'));

<Suspense fallback={<RecommendationSkeleton />}>
  <ProductRecommendations productId={product.id} />
</Suspense>
```

Die CLS-Reduzierung: Liquid verursachte Dynamic Content Shift (Warenkorb-Drawer, Promo-Banner), Hydrogen eliminiert Layout Shift durch Skeleton Components.

## Developer Experience: Team-Feedback

60 Tage nach der Migration befragten wir das Dev-Team (5 Entwickler):

**Größte Hürden in Liquid:**
- 80% „Lange Debug-Zyklen"
- 60% „Fehlende moderne Tools (TypeScript, Hot Reload)"
- 40% „Keine Component-Wiederverwendbarkeit"

**Größte Vorteile in Hydrogen:**
- 100% „TypeScript + IDE Autocomplete"
- 80% „HMR für schnellere Entwicklung"
- 60% „Zugang zum React-Ökosystem"

Negatives Feedback: Mangelnde Hydrogen-Dokumentation (40%), Lernkurve des Shopify Remix Router (20%).

## Wann Liquid verbleiben sinnvoll ist

Die Entscheidung gegen Migration zu Hydrogen macht Sinn unter diesen Bedingungen:

1. **Site-Traffic <10K Sessions/Monat:** TTFB-Unterschied ist unauffällig, Migration-ROI nicht vorhanden.
2. **Theme wenig customized:** Off-the-shelf-Theme, Migration-Aufwand nicht gerechtfertigt.
3. **Dev-Team kennt React nicht:** Lernkosten + Onboarding verlängern Migration um Faktor 2–3.
4. **Kein Shopify Plus:** Oxygen-Hosting ist in Shopify Plus enthalten, sonst Zusatzkosten für Basic/Advanced Plans.

## Nach der Entscheidung: Production-Rollout-Strategie

Drei-Phasen-Rollout:

1. **Beta-Umgebung:** Hydrogen-Site auf Vercel deployed, 2 Wochen internes Testing (QA + Stakeholder).
2. **Canary Release:** 10% Traffic zu Hydrogen umgeleitet (Cloudflare Workers A/B-Split), Conversion-Rate-Delta +2,3%.
3. **Full Rollout:** Nach 14 Tagen 100% Traffic zu Hydrogen, Liquid-Theme als Fallback erhalten.

Post-Launch-Metrik: Checkout-Conversion-Rate 3,8% → 4,1% (Effekt von TTFB-Reduktion + CLS-Verbesserung). Geschätzter Jahresumsatz-Impact: $180K (durchschnittlicher AOV $120, 15K Bestellungen/Monat).

Die Hydrogen-Entscheidung war zahlenbasiert richtig: TTFB -82%, Developer Velocity +98%, Migrationskosten in Jahr eins amortisiert. Der Grund für den Wechsel von Liquid war nicht nur Performance, sondern modernes Developer Experience und Flexibilität der Composable-Architektur. Will man im Shopify-Ökosystem bleiben und zu Headless migrieren, ist Hydrogen die einzige sinnvolle Wahl.