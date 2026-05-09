---
title: "Shopify Hydrogen vs Liquid: Entscheidung nach Kennzahlen"
description: "TTFB 840ms → 180ms, Build-Zeit 12min → 90sec. Die Zahlen hinter der Hydrogen-Migration, Trade-offs und Migrations-Kostenrechnung."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: techstack-partnership
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, remix, ttfb]
readingTime: 9
author: Roibase
---

Wir nutzen Shopify Liquid-Themes seit 7 Jahren. Als die Grenzen bei Theme-Anpassungen, feste Server-Response-Zeiten und monolithische Deploy-Zyklen uns zu bremsen begannen, kam das Wort „Headless" auf den Tisch. Aber die entscheidende Frage lautete: Wie messen wir den ROI einer Hydrogen-Migration? Dieser Text dokumentiert die numerischen Details unserer Antwort — TTFB, Build-Zeit, Developer Velocity, Migrations-Kosten. Wir wählten Hydrogen, weil es nicht nur ein Framework ist, sondern messbare Performance-Gewinne liefert.

## Liquid's Performance-Ceiling

Shopifys Liquid-Template-Engine rendert serverseitig HTML. Die Liquid-Syntax wird auf dem Server geparsed, Storefront-API-Aufrufe laufen ab, HTML wird zusammengefügt und an den Client gesendet. Diese Architektur ist einfach und stabil — aber mit Grenzen.

In unserem Production-Store lag der Median-TTFB bei 840ms (RUM-Daten, Cloudflare Analytics). Das 95. Perzentil erreichte 1,4 Sekunden. Shopifys Server-Response-Time steht nicht unter unserer Kontrolle — Shared Infrastructure. Auch wenn wir das Liquid-Theme optimieren (unused sections lazy-laden, snippet-Count senken), bleibt die serverseitige Latenz konstant.

Build-Zeit ist ein separates Problem. Bei Theme-Änderungen pusht man über die Shopify CLI. Die durchschnittliche Deploy-Dauer: 12 Minuten. In der CI/CD-Pipeline bedeutet das Warten zwischen Stages. A/B-Test-Iteration wird langsam. Developer Velocity sinkt.

```bash
# Liquid-Theme Deploy (durchschnittlich)
shopify theme push --store=production
⏱ Upload: 4m 20s
⏱ Verarbeitung: 7m 40s
✅ Gesamt: 12m 00s
```

Liquid's Trade-off: einfaches Setup, null Infrastructure-Management — aber keine Performance-Kontrolle, langsame Iteration.

## Hydrogen's Versprechen

Hydrogen ist Shopifys Remix-basiertes Headless-Framework. React Server Components, Streaming SSR, Edge-Deployment. Der architektonische Unterschied: Bei Liquid rendert der Shopify-Server HTML. Bei Hydrogen deployest du deinen eigenen Edge-Server (Oxygen, Cloudflare, Vercel). Du rufst die Storefront-API direkt auf, streamst die Response in den Component-Tree.

TTFB-Versprechen: Weil du vom Edge-Node renderst, fällt die Shopify-Server-Latenz weg. Deploy zu Cloudflare Workers senkt den Median-TTFB auf 100–200ms (Cloudflare POP-Latenz + Storefront-API RTT). Build-Zeit-Versprechen: Vite-basierter Build, inkrementelles Deployment, unter 2 Minuten.

Aber neben den Versprechen gibt es Kosten: Migrations-Aufwand, Developer Learning Curve, Infrastructure-Ownership. Wir modellierten diese Trade-offs numerisch.

### Benchmark-Methodologie

Wir setzten zwei Umgebungen auf:
1. **Liquid Baseline:** Production-Store, Dawn-Theme-Fork, 80+ Sections, Cloudflare Proxy (Cache Bypass)
2. **Hydrogen Prototype:** Identische Homepage-Component-Tree, Cloudflare-Workers-Deployment, Storefront-API 2024-01

Test-Setup:
- WebPageTest (Dulles-Location, Moto G4, 3G Fast)
- Median-Werte aus 3 Läufen
- Cache-Cold-State (Cache-Flush vor jedem Test)

Metriken:
- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- Build-Zeit (im CI/CD gemessen)

## Performance-Vergleich

Ergebnisse (Median aus 3 Läufen):

| Metrik | Liquid | Hydrogen | Differenz |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **-79%** |
| **LCP** | 2,4s | 1,1s | **-54%** |
| **TBT** | 680ms | 220ms | **-68%** |
| **Build-Zeit** | 12m 00s | 1m 30s | **-88%** |

Der TTFB-Rückgang entsprach unseren Erwartungen. Bei Hydrogen erreicht der Cloudflare-Workers-Edge-Node die Storefront-API mit 40–60ms RTT (Shopifys CDN läuft ohnehin über Cloudflare). Bei Liquid macht der Shopify-Server Liquid-Parse + API-Aufruf + HTML-Zusammenstellung — minimum 600ms Overhead.

LCP-Gewinn kommt vom Streaming SSR. Hydrogen sendet das erste Byte früh und streamt HTML. Critical Content (Hero-Image, ATF-Produktgrid) wird zuerst gerendert, Below-the-Fold lazy-geladen. Bei Liquid blockiert HTML das Rendering — die ganze Seite wartet, bis sie bereit ist.

TBT-Rückgang resultiert aus Bundle-Größe + Hydrations-Optimierung. Bei Hydrogen nutzen wir React Server Components — Client-seitiges JS-Bundle 120KB (gzip). Das Liquid-Theme hatte jQuery + Custom-Scripts mit 340KB. Hydrations-Zeit fiel.

Build-Zeit-Unterschied hat direkte Auswirkung auf Developer Velocity. 12 Minuten statt 90 Sekunden — wenn du 10 Deployments täglich machst, sind das 115 Minuten Zeitersparnis. CI/CD beschleunigt sich, A/B-Test-Iteration wird schneller.

```typescript
// Hydrogen Streaming-SSR-Beispiel (Remix Loader)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Stream: erste Response kommt sofort zurück
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

Die `defer`-API streamt Promises. Der Client erhält erstes HTML, die Seite rendert progressiv, während Daten ankommen. TTFB bleibt niedrig.

## Migrations-Kostenrechnung

Performance-Gewinn ist klar — aber der Übergang? Wir erstellten die folgende Aufschlüsselung:

**Entwicklungs-Aufwand:**
- Theme → Hydrogen-Component-Migration: 160 Stunden (2 Senior-Developer, 4 Wochen)
- Storefront-API-Integration (GraphQL-Query-Rewrite): 40 Stunden
- CI/CD-Pipeline-Setup (Cloudflare Workers): 16 Stunden
- QA + Edge-Case-Fixes: 24 Stunden
- **Gesamt:** 240 Stunden

**Infrastructure-Kosten:**
- Cloudflare Workers: $5/Mo (kostenlos bis 100K Requests — unser Traffic 80K/Mo)
- Oxygen (Shopifys Edge-Plattform): $20/Mo Einsteiger-Tier
- Wir wählten Cloudflare — nutzen ohnehin Cloudflare Proxy

**Wartungs-Overhead:**
- Hydrogen-Version muss alle 6 Monate aktualisiert werden (Remix-Upstream)
- Developer Learning Curve: Team braucht React + Remix-Erfahrung
- Bei Liquid nutzen wir Shopify Theme Store — Hydrogen ist Custom-Entwicklung

One-Time-Migrations-Kosten: **240 Stunden × $80/Stunde = $19.200**. Jährliche Infrastructure-Kosten: **$60**.

Wie modellierten wir die Gegenleistung? Zwei Punkte:

1. **Conversion-Rate-Impact:** Core Web Vitals korrelieren mit Conversion-Rate (Google/Deloitte-Studie: 0,1s LCP-Senkung = 1–2% Conversion-Lift). Unsere LCP sank um 1,3s — konservativer Schätzwert 1,5% Lift. Bei monatlichem Revenue von $200K = $3K/Mo Lift. Jährlich **$36K**.

2. **Developer Velocity:** Build-Zeit um 88% reduziert. Team macht 40 Deployments/Monat. Jedes Deployment spart 10,5 Minuten = Monat 420 Minuten = 7 Stunden. Senior-Developer $80/Stunde — monatliche Ersparnis $560. Jährlich **$6.700**.

Amortisationszeit: $19.200 / ($36K + $6.700) = **5,4 Monate**.

Diese Rechnung rechtfertigt die Migration. Performance-Gewinn + Developer-Velocity zahlen die Migrations-Kosten in 6 Monaten zurück.

## Trade-offs und Grenzen

Hydrogen ist nicht für jeden Store die richtige Wahl. In diesen Szenarien bleibt Liquid sinnvoll:

**Liquid sollte bleiben:**
- Traffic niedrig (<10K/Mo Visitor) — TTFB-Unterschied wirkt nicht auf Conversion
- Team kennt React/TypeScript nicht — Learning Curve verdoppelt Migrations-Kosten
- Theme-Store-Template reicht — keine Custom-UI/UX-Anforderungen
- Infrastructure-Management unerwünscht — Shopify-Server ist simpel

**Hydrogen sollte es sein:**
- Traffic hoch (>50K/Mo) — jede 100ms TTFB beeinflußt Conversion
- Custom UI/UX notwendig — [Headless Commerce](https://www.roibase.com.tr/de/headless)-Architektur bietet Flexibilität
- A/B-Test-Iteration ist kritisch — CI/CD muss unter 2 Minuten laufen
- Developer-Team arbeitet mit modernem Frontend-Stack (React/Remix)

Hydrogen hat auch Wartungskosten. Remix bringt alle 6 Monate Major-Versions. Hydrogen folgt dem. Bei Liquid garantiert Shopify Backward-Compatibility — altes Theme funktioniert in 5 Jahren noch. Hydrogen erfordert Disziplin bei Dependency-Updates.

Edge-Deployment bringt auch Grenzen. Cloudflare-Workers-Runtime hat Beschränkungen (CPU-Zeit 50ms, Memory 128MB). Komplexe Backend-Logik (z.B. Recommendation Engine) läuft nicht am Edge — muß zum Origin-Server. Bei Liquid ist das kein Problem, Server-Seite ist unbegrenzt.

## Wo wir jetzt stehen

Wir wählten Hydrogen — weil TTFB um 79% sank, Build-Zeit um 88% fiel, Amortisationszeit 5,4 Monate. Aber die Entscheidung basierte auf einer Migrations-Kostenrechnung und klar definierten Trade-offs.

Falls du auch eine Hydrogen-Migration erwägst: Beantworte erst diese Fragen. Monatlich wie viele Visitor? Kennt dein Team React? Brauchst du Custom-UI/UX? Hast du eine CI/CD-Pipeline? „Ja" auf diese Fragen heißt: numerisches Modell erstellen. TTFB-Differenz in Conversion-Lift umrechnen, Developer-Velocity-Gewinn in Stunden multiplizieren. Wenn diese Zahlen die Migrations-Kosten rechtfertigen — dann los.

Im Zuge einer Headless-Migration können wir dir [Shopify-Partnerservices](https://www.roibase.com.tr/de/shopify) anbieten — Hydrogen-Migrations-Roadmap, Benchmark, Kostenmodell, schrittweiser Rollout-Plan inklusive.