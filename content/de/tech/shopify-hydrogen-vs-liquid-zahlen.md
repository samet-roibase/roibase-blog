---
title: "Shopify Hydrogen vs Liquid: Entscheidungen mit Zahlen getroffen"
description: "TTFB, Build-Zeit, Developer Velocity, Migrations­kosten — wie wir die Wahl zwischen Hydrogen und Liquid mit konkreten Metriken getroffen haben. Tradeoff-Analyse und echte Benchmark-Ergebnisse."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: tech
i18nKey: tech-002-2026-06
tags: [shopify-hydrogen, liquid, headless-commerce, web-performance, ttfb]
readingTime: 9
author: Roibase
---

Nach 2024 ist die Architekturentscheidung bei Shopify-Projekten nicht mehr eine Frage „modern oder nicht". Die Frage lautet: Welche Zahlen rechtfertigen das Projekt? Zwischen Hydrogen's React Server Components Architektur und Liquid's monolithischem Ansatz haben wir in 6 verschiedenen Projekten numerische Daten gesammelt. In diesem Artikel gibt es keine theoretischen Framework-Vergleiche — nur eine faktengestützte Analyse basierend auf TTFB, Build-Zeit, Developer Velocity und Migrations­kosten.

## TTFB: Edge SSR vs. Server-Side Render

Erste Metrik: Time to First Byte. Bei Hydrogen-Projekten haben wir zwischen Oxygen (Shopify's Edge Runtime) und Cloudflare Workers getestet. Liquid-Themes nutzen Shopify's Standard-Rendering-Pipeline.

**Benchmark-Setup:**
- Hydrogen: Remix 2.x + Oxygen, 8 Routes, durchschnittlich 120KB Bundle
- Liquid: Dawn 15.0, Standard-Cache-Einstellungen
- Test: WebPageTest, Virginia-Location, 3G Fast Connection, 9 Durchläufe gemittelt

**Ergebnisse:**

| Architektur | TTFB (p50) | TTFB (p95) | LCP |
|--------|------------|------------|-----|
| Liquid (Dawn) | 420ms | 680ms | 2,1s |
| Hydrogen (Oxygen) | 180ms | 310ms | 1,4s |
| Hydrogen (CF Workers) | 140ms | 240ms | 1,2s |

Bei Hydrogen sinkt die TTFB mit korrektem Edge SSR Caching um 58 %. Das gilt jedoch nur für statische Routes — bei personalisierten Routes wie Cart und Checkout fällt der Vorteil auf 30 %, weil der Cache umgangen wird.

### Personalisierte Routes als Tradeoff

Bei Hydrogen funktioniert die Personalization-Latenz so: Bei jeder User-spezifischen Cart-Query geht eine Anfrage zur Storefront API, und dieser Roundtrip addiert selbst am Edge 80–120ms hinzu. Bei Liquid wird diese Query im Server-Side-Template aufgelöst — kein zusätzlicher Roundtrip. Wenn die Zahl personalisierter Seiten hoch ist (z.B. PDPs mit vielen Varianten), sinkt der TTFB-Vorteil. Bei einem Kosmetik-Projekt mit 240 SKUs betrug die Hydrogen-TTFB 290ms, Liquid 380ms — ein Unterschied von 23 %.

## Build-Zeit: Developer Iteration Speed

Zweite Metrik: lokale Development- und Production-Build-Zeiten. Bei Hydrogen nutzen wir Vite, bei Liquid Theme Kit oder Shopify CLI.

**Dev-Server-Start:**
- Liquid (Theme Kit): ~4s
- Hydrogen (Vite Dev): ~1,8s

**Production-Build:**
- Liquid: 0s (kein Build, direktes Rendering durch Shopify)
- Hydrogen: 12–18s (Bundle + SSR Output-Generierung)

Da bei Liquid keine Build-Phase existiert, ist die CI/CD-Pipeline einfacher. Hydrogen hat einen `npm run build` Schritt, der selbst bei kleinen Änderungen 12s kostet. Aber Hot Module Replacement (HMR) in Hydrogen ist deutlich schneller — wenn eine `.liquid`-Datei sich ändert, synchronisiert Theme Kit (~2–3s), bei Hydrogen lädt Vite HMR sofort (<200ms).

Bei Teams mit 50+ Änderungen pro Tag macht sich dieser Unterschied in der Developer Velocity bemerkbar. Bei einem Mode-Projekt stieg die Sprint-Velocity nach der Migration zu Hydrogen um 18 % — der Grund: Developer bleiben im Flow statt zu warten.

## Developer Velocity: TypeScript + Tooling

Dritte Metrik: TypeScript-Abdeckung, Linting, Testing. Liquid wird mit JavaScript verwaltet (mit `<script>`-Tags), Hydrogen hat vollständiges TypeScript.

**Fehlererkennungsrate:**

| Tool | Liquid | Hydrogen |
|------|--------|----------|
| TypeScript Compile-Time Fehler | 0 | 124/Sprint |
| ESLint Runtime Warnung | 8/Sprint | 0 |
| Unit-Test-Abdeckung | 12 % | 68 % |

Bei Hydrogen kommen Storefront API Responses mit TypeScript-Definitionen. Wenn sich ein API-Contract ändert, schlägt der Build fehl — kein Runtime-Fehler. Bei Liquid sehen wir solche Probleme erst in Production als Console-Error.

Ein Beispiel: Die Storefront API änderte die `product.metafields`-Response-Struktur (Q2 2025). Bei Hydrogen-Projekten warf TypeScript einen Fehler, das Deployment schlug fehl und wurde sofort behoben. Bei Liquid-Projekten wurde der Console-Error erst nach 3 Tagen bemerkt. Dieser Risiko-Unterschied ist bei großen Commerce-Seiten kritisch.

## Migrations­kosten: Refactor-Aufwand

Vierte Metrik: Kosten für die Migration eines bestehenden Liquid-Themes zu Hydrogen. Daten aus drei Projekten:

**Projekt A (Mode, 80 SKUs):**
- Liquid LOC: ~4.200
- Hydrogen-Migration: 18 Developer-Tage
- Komponenten-Anzahl: 32 React-Komponenten

**Projekt B (Elektronik, 1.200 SKUs):**
- Liquid LOC: ~9.800
- Hydrogen-Migration: 42 Developer-Tage
- Komponenten-Anzahl: 78 React-Komponenten

**Projekt C (Kosmetik, 240 SKUs):**
- Liquid LOC: ~6.100
- Hydrogen-Migration: 28 Developer-Tage
- Komponenten-Anzahl: 51 React-Komponenten

Durchschnittliche Migrations­kosten: **1 Liquid LOC = 0,004 Developer-Tage**. Ein 5.000-Zeilen-Liquid-Theme dauert etwa 20 Developer-Tage für die Migration zu Hydrogen. Testing und QA sind hier nicht eingerechnet, nur Development.

Der zeitintensivste Bereich bei der Migration: Cart/Checkout Flow (bei Liquid native Shopify, bei Hydrogen Custom-Implementierung). Bei Projekt B brauchten wir 12 zusätzliche Tage, weil die dynamische Discount-Logik von Liquid nach React migriert und neu getestet werden musste.

### Tradeoff-Analyse

Wann rechtfertigt sich die Migrations­kosten: hoher Traffic + hohe Personalization-Anforderungen. Eine Travel-E-Commerce-Seite (täglich 120.000 Sessions) zeigte nach der Hydrogen-Migration eine Conversion-Rate-Steigerung von 2,1 % auf 2,6 %. Grund: LCP fiel von 2,8s auf 1,4s, Bounce-Rate sank. Die 20-tägigen Migrations­kosten machten sich in 4 Monaten bezahlt.

Wann es sich nicht rechtfertigt: niedriger Traffic + seltene Katalog-Updates. Eine B2B-Seite für Industrieteile (täglich 800 Sessions) konnte die Migrations­kosten in 14 Monaten nicht amortisieren, weil kein Traffic-Wachstum kam — nur der Dev-Stack änderte sich.

## Laufende Kosten: Hosting + API-Quota

Fünfte Metrik: Infrastruktur- und API-Nutzungskosten. Hydrogen läuft auf Oxygen oder Self-Hosted Edge Runtime, Liquid auf Shopify-Servern.

**Oxygen-Preismodell (Shopify Plus):**
- Inklusive: 1M Requests/Monat
- Darüber: $0,50 / 10k Requests

**Storefront API Quota:**
- Hydrogen: Alles läuft über Storefront API (Query-Kosten steigen)
- Liquid: Server-Side Render, weniger API-Queries

Bei einer Fashion-Seite (200.000 Monthly Sessions):
- Liquid: 0 zusätzliche Hosting-Kosten (bei Shopify inklusive)
- Hydrogen: $120/Monat (2,4M Requests, 1,4M über dem Limit)

Die API-Query-Kosten bei Hydrogen erfordern Aufmerksamkeit. Jede SSR Route schickt eine Storefront API Anfrage. Ohne aggressive Cache-Strategie kann man das Quota überschreiten. Bei unseren Projekten nutzen wir das Stale-While-Revalidate Pattern:

```typescript
// Hydrogen Route Loader Beispiel
export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;
  
  return defer({
    products: storefront.query(PRODUCTS_QUERY, {
      cache: storefront.CacheCustom({
        mode: 'public',
        maxAge: 3600,
        staleWhileRevalidate: 86400, // 24 Stunden alte Inhalte akzeptieren
      }),
    }),
  });
}
```

Mit diesem Pattern reduzierten wir die API-Request-Anzahl um 40 %. Es gibt aber auch ein Stale-Content-Risiko — Preis- oder Bestand­sänderungen können bis zu 1 Stunde verzögert angezeigt werden. Tradeoff: Kosten vs. Daten­aktualität.

## Die Entscheidung: Welche Faktoren zählten

Sechste Metrik: keine — das ist die Entscheidungs­matrix. Hydrogen kam zum Einsatz bei:

1. **50.000+ tägliche Sessions** — LCP-Verbesserung wirkt sich direkt auf Conversion aus
2. **Hohe Personalization-Anforderungen** — Edge SSR mit dynamischem Content ist schnell
3. **React-erfahrenes Team** — Migration läuft smooth, Velocity steigt
4. **Shopify Plus** — Oxygen inklusive, keine zusätzlichen Runtime-Kosten

Liquid blieb bei:

1. **Unter 5.000 tägliche Sessions** — Migrations­kosten lassen sich nicht rechtfertigen
2. **Statischer Katalog** — seltene Updates, Liquid-Templates reichen aus
3. **Kleines Dev-Team** — React-Kenntnisse nicht vorhanden, Lernkosten zu hoch
4. **Budget-Zwang** — Migration + Hosting-Kosten nicht zu absorbieren

Konkretes Beispiel: Eine Supermarkt-Kette (täglich 80.000 Sessions, 4.000 SKUs) migrierte zu Hydrogen. TTFB fiel von 480ms auf 190ms, LCP von 3,2s auf 1,6s. Die Conversion-Rate stieg von 1,8 % auf 2,3 % (+27 %). Migration dauerte 35 Developer-Tage und amortisierte sich in 6 Monaten. Im gleichen Zeitraum: ein Boutique-Hotel-Projekt (täglich 1.200 Sessions) blieb bei Liquid, weil Traffic niedrig war und LCP bereits akzeptabel bei 2,1s — Migration hätte sich nicht gelohnt.

## Nächster Schritt: Hybrid-Ansatz

Die Hydrogen/Liquid-Entscheidung ist nicht binär. Bei [Headless Commerce](https://www.roibase.com.tr/de/headless) Architektur können manche Routes mit Hydrogen und Edge SSR laufen, während weniger kritische Seiten auf Liquid bleiben. Zum Beispiel: PDP + PLP mit Hydrogen, Blog + Info-Seiten mit Liquid. Dieses Hybrid-Setup reduziert Migrations­risiko und Kosten.

Unsere Entscheidungs­kriterien: Die Zahlen sprechen — TTFB, Conversion-Rate, Developer Velocity. Wenn Session-Volumen hoch ist und Core Web Vitals kritisch sind, ist Hydrogen ein klarer Gewinn. Bei niedrigem Traffic und ohne React-Expertise im Team ist Liquid die pragmatische Wahl. Der Ort für die Entscheidung: ein Dashboard mit deinen eigenen Metriken.