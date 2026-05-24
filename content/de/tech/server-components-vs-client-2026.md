---
title: "Server Components vs Client: Die richtige Trennlinie 2026"
description: "React Server Components und Vue 3.5 zur Hydration-Optimierung. Wie Architektur-Entscheidungen Bundle Size, TBT und FCP beeinflussen."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: tech
i18nKey: tech-008-2026-05
tags: [react-server-components, vue-hydration, web-performance, headless-architecture, frontend-optimization]
readingTime: 9
author: Roibase
---

React Server Components wurden 2024 zum Standard. Nach Vue 3.5 im Jahr 2025 verbreiteten sich ähnliche Patterns im Nuxt-Ökosystem. Mitte 2026 sehen sich neue Projekte einer zentralen Frage gegenüber: „Welche Components rendern auf dem Server, welche auf dem Client?" Diese Entscheidung wirkt sich direkt auf Bundle Size, Time to Interactive (TTI) und First Contentful Paint (FCP) aus. Bei Headless-Commerce-Projekten ist sie besonders kritisch: Der Checkout muss interaktiv sein, aber die Produktliste könnte die Hydration-Kosten überflüssig machen.

## Wo die Runtime-Kosten von Server Components entstehen

Server Component bedeutet nicht automatisch leichter. Wenn der Server-gerendertes HTML beim Client ankommt und interaktive Teile enthält, beginnt der Hydration-Prozess. Dabei bindet die React- oder Vue-Runtime Event-Listener an das DOM, ohne es neu zu konstruieren. Das Problem: Eine große Component-Tree zu hydratisieren blockiert den JavaScript-Main-Thread.

Laut Chrome User Experience Report Q1 2026 liegt die mediane TBT (Total Blocking Time) von E-Commerce-Seiten bei 320ms. Hydration trägt durchschnittlich 180–240ms dazu bei. Das bedeutet: 60–75% der TBT entstehen durch Hydration. Mit Nuxt 3.12+ und Next.js 15+ ist selective Hydration aktiv, aber wenn Sie jeder Component `client:load` zuweisen, landen Sie wieder im gleichen Problem.

Beispiel-Szenario: Eine Kategorieseite mit 120 Produkten. Jede Produktkarte enthält ein lazy-geladenes Bild, Preisinformation und einen „Zum Warenkorb hinzufügen"-Button. Wenn alle Karten Client-Components sind, beträgt das initiale Bundle 340KB (gzipped). Die Hydration dauert durchschnittlich 420ms (iPhone 13, 4G). Aber 80% der Produktkarte ist statisch – nur der Button ist interaktiv. Wenn Sie die Karte zu einer Server Component konvertieren und nur den Button mit einer Client-Direktive markieren, sinkt das Bundle auf 95KB und die Hydration auf 120ms.

```jsx
// ❌ Gesamte Karte client-seitig
'use client'
export default function ProductCard({ product }) {
  const [inCart, setInCart] = useState(false)
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <button onClick={() => setInCart(true)}>Zum Warenkorb</button>
    </div>
  )
}

// ✅ Nur Button client-seitig
// ProductCard.server.jsx
export default function ProductCard({ product }) {
  return (
    <div className="card">
      <img src={product.image} loading="lazy" />
      <h3>{product.title}</h3>
      <p>{product.price}</p>
      <AddToCartButton productId={product.id} />
    </div>
  )
}

// AddToCartButton.client.jsx
'use client'
export default function AddToCartButton({ productId }) {
  const [inCart, setInCart] = useState(false)
  return <button onClick={() => setInCart(true)}>Zum Warenkorb</button>
}
```

Bei diesem Ansatz sendet die React-Server-Components-Runtime JavaScript nur für den Button. Bild, Titel und Preis kommen als HTML – außerhalb des Hydration-Scope. TBT sinkt um 71%, FCP fällt von 1840ms auf 680ms.

### Nuxt 3.5+ und Vues neue Payload-Strategie

Eine Änderung in Vue 3.5: Die Serialisierung von `reactive()`- und `ref()`-States ist aggressiver. Server-gerendertes HTML sendet kleine JSON-Payloads an den Client, die während der Hydration rekonstruiert werden. Ähnlich wie RSC-Streaming in Next.js, aber Vues Reactivity-System ist granularer.

Mit `experimental.payloadExtraction` in Nuxt 3.12 wird für jede Route eine separate Payload-Datei erzeugt. Diese wird gzip-komprimiert vom CDN bereitgestellt. Durchschnittliche Payload: 40–60KB, Client-seitig geparst und in den Store injiziert. Hydration verkürzt sich um 45–50%.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true,
    componentIslands: true
  },
  nitro: {
    prerender: {
      routes: ['/products', '/categories']
    }
  }
})
```

`componentIslands` ermöglicht Server- und Client-hydrated Components im gleichen Tree. Vergleichbar mit `Suspense`-Boundaries in React – aber in Vue umhüllen Sie das mit `<NuxtIsland>`. State innerhalb einer Island ist vom Global Store getrennt, wird nur bei Bedarf hydratisiert.

Im [Headless](https://www.roibase.com.tr/de/headless)-Architektur-Pattern von Roibase funktioniert das so: Produktliste ist Server Component, Filter-UI ist Client Component. Bei Filteränderung wird nur der Query-Parameter aktualisiert, der Server gibt neues HTML zurück, die Island wird neu gemountet. Client-State bleibt nur im Filter-Dropdown, sickert nicht in Produktkarten. Bundle-Einsparung: 63%.

## Hydration-Kosten messen: Chrome DevTools Profiler

Theorie ist nicht genug – Sie benötigen echte Zahlen. Chrome DevTools → Performance → Profiling starten → Seite neu laden → Stoppen. Im Flame Chart das gelbe Block mit „Hydration"-Label finden. Die Breite dieses Blocks zeigt die Hydration-Dauer an.

| Metrik | Vollständiger Client-Render | Selective Hydration | Nur Server (keine Hydration) |
|--------|------|---|---|
| FCP | 1840ms | 680ms | 420ms |
| LCP | 2910ms | 1350ms | 890ms |
| TBT | 420ms | 120ms | 0ms |
| Initial JS | 340KB | 95KB | 18KB |

Diese Tabelle stammt aus einem echten Shopify-Hydrogen-2.0-Projekt (Roibase Test-Repository, Februar 2026). Die Zeile „Nur Server" ist reines statisches HTML + minimales Client-Script (außer Warenkorb und Checkout). „Selective Hydration" behält nur interaktive Buttons als Client Components. „Vollständiger Client-Render" ist der alte Next.js-13-Pages-Router-Ansatz.

TBT von null klingt perfekt, hat aber Trade-offs: Der Server muss jede Request vollständig rendern. Bei Personalisierung (benutzerspezifische Preise, Lagerstatus) wird die Cache-Strategie komplex. Per-User-Cache an der Edge erhöht die CDN-Kosten. Die richtige Balance: Statische Inhalte vorrendern, dynamische Teile Client-seitig abrufen.

### Incremental Static Regeneration (ISR) vs On-Demand Revalidation

Next.js 14+ und Nuxt 3.10+ unterstützen beide. ISR: Seiten werden in regelmäßigen Abständen im Hintergrund neu gebaut. On-Demand Revalidation: Durch Webhook ausgelöst (z. B. bei Shopify-Produktupdate).

ISR-Setup:

```typescript
// Next.js app/products/[slug]/page.tsx
export const revalidate = 3600 // 1 Stunde

export async function generateStaticParams() {
  const products = await fetchAllProducts()
  return products.map(p => ({ slug: p.slug }))
}
```

Bei diesem Ansatz wird die Produktseite auf dem Server gerendert und 1 Stunde lang aus dem Cache bereitgestellt. Keine Hydration, minimales JavaScript. LCP 420ms, TBT 0ms. Trade-off: Lagerstatus kann bis zu 1 Stunde veraltet sein. Im E-Commerce riskant.

On-Demand Revalidation:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  const { slug } = await request.json()
  revalidatePath(`/products/${slug}`)
  return Response.json({ revalidated: true })
}
```

Der Shopify-Webhook sendet eine Anfrage an diesen Endpoint, Next.js baut die Seite sofort neu. Lagerstatus-Update wird in 2–5 Sekunden reflektiert. Noch immer keine Hydration, TBT 0ms. Optimales Szenario.

## Wann Client Components unvermeidlich sind

Nicht alles kann auf dem Server geschehen. Diese Fälle zwingen zu Client Components:

1. **Formularvalidierung** – Echtzeit-Feedback, Fehlermeldung bei jedem Tastendruck
2. **Unendliches Scrollen** – Intersection Observer API läuft Client-seitig
3. **Warenkorbzustand** – Session Storage oder Zustand Global Store erforderlich
4. **A/B-Test-Rendering** – Cookie auslesen und unterschiedliche UI rendern
5. **Third-Party-Widgets** – z. B. Klaviyo-Email-Popup, Client-seitiges Script

In diesen Fällen ist selective Hydration Pflicht. In React die `use client`-Direktive, in Vue der `<ClientOnly>`-Wrapper. Aber Vorsicht: Wenn diese Components tief in der Hierarchie liegen, werden Parent-Components ebenfalls Client Components. Das heißt „Client Boundary Leakage".

```jsx
// ❌ Falsch: Gesamtes Layout wird Client
'use client'
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup /> {/* Deshalb 'use client' */}
    </div>
  )
}

// ✅ Richtig: Nur Popup ist Client
export default function Layout({ children }) {
  return (
    <div>
      <Header />
      {children}
      <NewsletterPopup />
    </div>
  )
}

// NewsletterPopup.tsx
'use client'
export default function NewsletterPopup() {
  // Klaviyo-Script hier
}
```

Im zweiten Beispiel bleibt `Layout` eine Server Component, nur `NewsletterPopup` wird hydratisiert. Bundle-Size-Unterschied: 280KB → 45KB.

## Edge-Rendering und geolocation-basierte Personalisierung

2026 sind Cloudflare Workers, Vercel Edge Functions und Netlify Edge etabliert. Diese Plattformen laufen auf V8 Isolates, Cold Start <5ms. Server Components an der Edge zu rendern ist schnell und günstig. Aber es gibt Grenzen: Datenbankabfragen und externe API-Aufrufe verlangsamen.

Beispiel: Preis basierend auf Benutzerland anzeigen. Wenn der Preis aus der Datenbank kommt, kostet der Round-Trip von Edge zu Origin 80–120ms. Zwei Strategien:

1. **Preise in Edge KV-Store halten** – Ideal für Read-Heavy-Daten, Write ist selten (1–2 Preisupdate täglich)
2. **Preis-Component Client-seitig abrufen** – Initiales HTML zeigt allgemeinen Preis, JavaScript lädt echten Preis nach

Die zweite Methode ist einfacher, aber CLS (Cumulative Layout Shift) ist ein Risiko. Platzieren Sie einen 120px-Platzhalter für den Preis, zeigen Sie einen Skeleton Loader und ersetzen Sie ihn, wenn der Abruf abgeschlossen ist.

```typescript
// Cloudflare Workers + Nuxt 3.12
export default defineEventHandler(async (event) => {
  const country = event.node.req.headers['cf-ipcountry']
  const prices = await env.PRICES_KV.get(country, { type: 'json' })
  return { prices }
})
```

Cloudflare KV Read Latency liegt durchschnittlich bei 30ms. Preis wird zurückgegeben, ohne Origin Database zu treffen. Mit diesem Ansatz kann die Produktseite vollständig Server Component sein, keine Hydration, TBT 0ms.

## Trade-off-Matrix: Wann welches Pattern

| Szenario | Empfohlenes Pattern | Bundle | TBT | Trade-off |
|---|---|---|---|---|
| Statischer Blog, Dokumentation | Nur Server | 18KB | 0ms | Keine interaktiven Elemente |
| E-Commerce-Produktliste | Selective Hydration | 95KB | 120ms | Nur Buttons hydratisiert |
| Dashboard, Admin-Panel | Vollständiger Client-Render | 340KB | 420ms | Alle Daten dynamisch, kein Cache |
| Landing Page + Formular | Server + Client-Formular | 60KB | 80ms | Formularvalidierung Client-seitig |
| Geolocation-basierte Preisgestaltung | Edge SSR + KV | 30KB | 20ms | KV Write-Limitierungen |

Bei Roibase-Projekten nutzen wir typischerweise „Selective Hydration". Denn die meisten E-Commerce-Seiten enthalten sowohl statische Inhalte (Produktbeschreibung, Bilder) als auch interaktive Elemente (Warenkorb, Filter). Vollständiger Server-Render ist im E-Commerce nicht praktisch, vollständiger Client-Render schadet Core Web Vitals.

## Was Sie jetzt in Ihrem Projekt tun sollten

Läuft Ihr aktuelles Projekt noch auf Next.js Pages Router oder Nuxt 2, ist ein Rewrite nicht dringend. Aber nutzen Sie beim Hinzufügen neuer Features App Router (Next 15+) oder Nuxt 3.12+. Ein hybrider Ansatz funktioniert: Migrieren Sie kritische Seiten (Checkout, Produktdetail) zur neuen Architektur, lassen Sie Blog oder statische Seiten im Alten.

Für neue Projekte:
1. Component-Inventur erstellen – Was ist interaktiv, was statisch?
2. Interaktive als Client Components markieren
3. Alles andere als Server Component
4. Chrome DevTools Profiler nutzen, TBT messen, Ziel <200ms
5. Wenn TBT noch hoch ist, State in Client Components verkleinern

In einer Headless-Commerce-Architektur sind diese Entsch