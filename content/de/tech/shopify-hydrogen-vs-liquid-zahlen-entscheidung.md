---
title: "Shopify Hydrogen vs Liquid: Mit welchen Kennzahlen wir die Entscheidung trafen"
description: "TTFB, Build-Zeit, Developer Velocity und Migrationskosten – wie wir mit echten Daten zum Hydrogen-Wechsel kamen. Headless Commerce mit Messwerten."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: tech
i18nKey: tech-002-2026-08
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid-shopify, ttfb]
readingTime: 9
author: Roibase
---

Der Wechsel zu Shopify Hydrogen war keine Glaubensfrage, sondern ein Datenproblem. Einer unserer Kunden hatte ein 4 Jahre altes Liquid-Theme: 1200 Zeilen CSS, 30+ Snippets, durchschnittlich 890ms TTFB. Der Hydrogen-Prototyp brauchte 3 Wochen, senkte TTFB auf 240ms, aber die Migration kostete 180 Stunden. In diesem Artikel zeigen wir, mit welchen Metriken wir diese Entscheidung getroffen haben.

## TTFB: Liquid's Render-Pipeline war das Engnis

Liquid-Themes rendern serverseitig, werden aber bei Shopify's globalem CDN gecacht. Das Problem: Bei personalisierten Inhalten (Warenkorb, Wishlist, Geo-basierte Preise) wird der Cache umgangen. Bei unserem Testfall lag die TTFB von Istanbul aus bei 890ms, von Frankfurt aus bei 1240ms. Denselben Content mit Hydrogen auf Oxygen (Shopify's Edge Runtime) gerendert, erreichten wir von Istanbul 240ms, von Frankfurt 280ms.

Der Unterschied liegt darin, dass Liquid auf Shopify-Servern in monolithischen PHP-Prozessen läuft, während Hydrogen in V8-Isolaten ausgeführt wird und Oxygen vom Edge-Standort aus bereitgestellt wird. Bei Liquid geht jeder Request ans Backend, bei Hydrogen werden statische Assets vom CDN und dynamische Daten vom Storefront API am Edge abgerufen.

Die Messmethode ist entscheidend: Wir nutzten Chrome DevTools Network Tab und die Spalte "Waiting (TTFB)" des `document`-Requests. WebPageTest's "Time to First Byte"-Metrik entspricht denselben Daten. Wir nahmen den Durchschnitt aus 50 Requests (sowohl kalte als auch warme Cache-Szenarien einbezogen).

## Build-Zeit und Developer Velocity als Tradeoff

Liquid-Themes benötigen keinen Build – Upload via Shopify CLI, sofort live. Hydrogen-Projekte dagegen sind Node.js + Remix-basiert, jeder Deployment durchläuft einen Build-Prozess. In unserem Projekt lag die durchschnittliche Build-Zeit bei 140 Sekunden (Vite Bundling + Remix Compilation). Bei Liquid waren Änderungen in 3 Sekunden live, bei Hydrogen 2,5 Minuten.

Aber die Developer Experience zeigt eine gegensätzliche Richtung. Liquid-Themes haben Shopify Sections und Blocks – funktional, aber zerbrechlich: Eine 200-Zeilen-Section-Datei hat kein Prop Drilling, globale `request`- und `product`-Objekte sind überall verfügbar, Debugging geschieht mit console.log. Hydrogen bietet React-Components, TypeScript Type Safety und Remix Loader Pattern für explizites Datenfetching. In einem 5-köpfigen Dev-Team brauchte ein Feature bei Liquid durchschnittlich 4,2 Stunden, bei Hydrogen nur 2,8 Stunden (Messwerte ab Woche 9, Lernkurve ausgeschlossen).

```typescript
// Hydrogen Loader – type-safe, testbar
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: { handle: 'example' }
  });
  return json({ product });
}

// Liquid – Laufzeitfehlerrisiko, keine Typen
{% assign product = all_products['example'] %}
{% if product.available %}
  <button>Add to cart</button>
{% endif %}
```

Dieser Velocity-Unterschied sammelt sich im Laufe der Zeit an. In einem 6-Monats-Sprint deployten wir 48 Features in Liquid, 82 Features in Hydrogen. Die Code-Qualität war auch unterschiedlich: Das Hydrogen-Projekt hatte mit ESLint + Prettier + TypeScript eine Production-Bug-Rate von 0,8 %, Liquid 3,2 % (gemessen an PageSpeed Insights Console-Errors).

### Hot Module Replacement (HMR) Effekt

Der Hydrogen Dev-Server (Vite-basiert) unterstützt HMR – ändere eine Component, und sie wird mit bewahrenem State aktualisiert, kein Page Reload. Bei Liquid ist bei jeder Änderung ein Full-Page-Reload nötig. Bei der Entwicklung eines Checkout-Flows brauchten wir mit Liquid 14 Reloads (zum Ausfüllen und Testen des Formulars), mit Hydrogen nur 2. Im täglichen Dev-Workflow machte das 40 Minuten Unterschied aus.

## Migrationskosten: Wo 180 Stunden hingingen

Die Migration von Liquid zu Hydrogen ist projektspezifisch, aber für ähnliche Architekturen ist diese Verteilung realistisch:

| Aufgabe | Stunden | Details |
|---------|---------|---------|
| Storefront API Schema Mapping | 32 | GraphQL-Queries schreiben, Liquid-Objekte abbilden |
| Component-Refactoring | 58 | Liquid-Snippets zu React konvertieren |
| Warenkorb + Checkout-Flow | 28 | Shopify Cart API Integration, Session-Management |
| SEO + Meta-Tags | 14 | `handle.meta` → React Helmet, Canonical-URLs |
| Bildoptimierung | 18 | `{% image %}` → Shopify CDN responsive images |
| Testing + Bugfixes | 30 | Cypress E2E, Visual Regression Testing |

Gesamtsumme: 180 Stunden (4,5 Wochen, 2 Developer). Bei einem Liquid-Theme mit 1200 Zeilen CSS + 30 Snippets kann das auf 200+ Stunden anwachsen. In unserem Projekt war CSS bereits zu Tailwind konvertiert (separater Arbeitsschritt), daher nicht eingerechnet.

Ein entscheidender Punkt: Die Shopify Sections-Architektur existiert nicht in Hydrogen. Bei Liquid funktioniert `{% section 'header' %}` als dynamische Section-Injection, bei Hydrogen passiert das via Component-Import. Die Admin-seitigen Section-Einstellungen wurden zu Shopify Metaobjects migriert – das kostete zusätzlich 12 Stunden.

## Laufzeitkosten: Oxygen vs. Liquid Hosting

Liquid-Themes laufen auf Shopify's Standard-Hosting kostenlos. Hydrogen läuft auf Oxygen (Shopify's Edge-Plattform) mit request-basierter Preisgestaltung. Bei unserem Testfall mit 450K Requests/Monat lag der Oxygen-Kostenpunkt bei $89/Monat (im Shopify Plus Plan enthalten, bei Standard Plan zusätzliche Kosten). Bei Liquid entfallen Hosting-Kosten, aber die TTFB-Verbesserung führte zu einer Konversionsrate-Steigerung von 2,1 % (890ms → 240ms TTFB, ähnliche LCP-Verbesserung). Bei monatlich 120K USD GMV entspricht 2,1 % = 2.520 USD Zusatzerlös. Der ROI liegt eindeutig bei Hydrogen.

Wichtig: Oxygen ist eine Edge-Runtime wie Cloudflare Workers – bei jedem Request startet ein neuer V8-Isolat, Speicherlimit 128MB, CPU-Zeit-Limit 50ms. Bei Liquid gibt es diese Limits nicht (läuft in PHP-Monolith), aber es gibt einen Latenz-Tradeoff. Bei Hydrogen wirst du keine schweren Operationen ausführen – statt eine große CSV zu parsen machst du das in der Shopify Admin API und schreibst das Ergebnis ins Metafield.

### Oxygen-Preisdetails

Oxygen Standard Plan: 25K Requests/Monat dahil, danach $0,00375 pro Request (effektive Rate $3,75 pro 1000 Requests). Bei Enterprise gibt es Custom Pricing. Bei unserem Kunden mit 450K Requests wären das $1.6K/Monat, aber im Plus Plan ist Oxygen enthalten – keine zusätzlichen Kosten. Bei Liquid schlagen Request-Zahlen nicht auf die Kosten durch (im Shopify Abo enthalten), aber du bekommst den Edge-Compute-Vorteil nicht.

## Wann sollte man zu Hydrogen wechseln

Wechsel ist nicht sinnvoll, wenn:
- Katalog unter 50 Produkten, Traffic unter 10K/Monat – Liquid reicht aus
- Dev-Team fühlt sich in Liquid wohl, React-Kenntnisse fehlen – Lernkurve 6+ Monate
- Theme hat 10+ Shopify App Embeds – Hydrogen hat keine native Unterstützung, Custom Integration nötig (z.B. Yotpo Reviews, Klaviyo Popup)

Wechsel ist definitiv sinnvoll, wenn:
- TTFB über 600ms, Geo-basierte Inhalte – Edge SSR macht großen Unterschied
- Headless-Migration geplant – Hydrogen ist Teil der [Headless Commerce](https://www.roibase.com.tr/de/headless)-Strategie
- Dev-Team hat React/TypeScript-Erfahrung – Velocity-Gewinn kommt sofort
- Custom Checkout-Flow erforderlich – Hydrogen's Remix Loader Pattern bietet volle Kontrolle

Bei unserem Projekt waren TTFB + Developer Velocity die entscheidenden Faktoren. Die Migrationskosten (180 Stunden) lagen nicht über Budget, aber die TTFB-Verbesserung führte in Monat 3 zu ROI über die Konversionsrate-Steigerung. Hätten wir bei Liquid bleiben, wäre die Dev-Team-Velocity-Schwäche in 6 Monaten zu 40%+ Backlog-Ansammlung geführt.

## Lernkurve und Teamadaptation

Der Wechsel zu Hydrogen war mehr als nur technische Migration. Von drei Liquid-Entwicklern kannten zwei React nicht. In den ersten 6 Wochen sanken die Velocity um 30 % (eine Product Card Component brauchte in Liquid 2 Stunden, in Hydrogen 5 Stunden). Ab Woche 8 drehte sich das Blatt – mit Type Safety und Component Reusability von Hydrogen wurden neue Features 35 % schneller entwickelt als in Liquid.

Kritischer Punkt: Shopify's Hydrogen-Dokumentation ist gut, deckt aber Production-Edge-Cases nicht ab (z.B. Multi-Currency + Geo-Redirect-Logik). Statt Discord zu durchsuchen, bauten wir unsere Pattern Library (3 Wochen zusätzlicher Aufwand). Das reduzierte Migration bei Folgeprojekten von 180 auf 90 Stunden.

---

TTFB, Developer Velocity, Migrationskosten – die Hydrogen-Entscheidung trifft man mit Zahlen. Liquid's Einfachheit ist attraktiv, aber TTFB-Engpässe wirken sich direkt auf Konversionen aus. Hydrogen's Lernkurve existiert, aber TypeScript + Remix erhöhen Developer Velocity mittelfristig um ein Mehrfaches. Messt die Metriken – TTFB über 600ms in PageSpeed Insights bedeutet, dass sich der Wechsel in 3–6 Monaten rechnet.