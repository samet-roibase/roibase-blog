---
title: "Composable Commerce: La Realtà di Produzione dell'Architettura MACH"
description: "BigCommerce, commercetools, Shopify Plus — quale flessibilità promette MACH e quali costi comporta in produzione? Cosa dovrai accettare?"
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: tech
i18nKey: tech-005-2026-06
tags: [composable-commerce, architettura-mach, headless-commerce, shopify-plus, bigcommerce]
readingTime: 9
author: Roibase
---

Il composable commerce dal 2024 viene venduto come la "nuova regola" del mercato. I principi MACH (Microservizi, API-first, Cloud-native, Headless) dovrebbero sostituire le piattaforme monolitiche centrali. Ma in produzione le cose cambiano: il bundle Catalyst di BigCommerce pesa 850kB, l'integrazione minima di commercetools costa $120k, e le funzionalità composable di Shopify Plus arrivano con il disagio della migrazione Hydrogen 2.0. Prima di decidere, i tradeoff devono parlare con numeri, non promesse.

## Il Costo Reale della Promessa MACH

Il nucleo della promessa del composable è la flessibilità: frontend, backend, payment, ricerca — ognuno indipendente, sostituibile quando necessario. Ma questa flessibilità si traduce in tre voci di costo.

**Il primo costo: il tempo di integrazione iniziale.** Su piattaforme API-only come commercetools, costruisci l'intera esperienza dal frontend al checkout. MVP medio: 16-20 settimane. Lo stesso percorso su Shopify Plus in 4 settimane. Il starter Catalyst di BigCommerce rappresenta una via di mezzo: Next.js preconfigurato + setup GraphQL Storefront API già in posto, ma devi customizzare ogni component dalla product listing page allo stato del carrello (8-12 settimane).

**Il secondo costo: l'orchestrazione del backend.** In un ambiente MACH ogni servizio è indipendente — ma la sincronizzazione dello stato tra loro ricade su di te. Esempio: servizio inventario (Fluent Commerce), pricing (Pimcore), promozioni (Talon.One) in endpoint separati. Per farli funzionare in tempo reale ti serve un event bus (Kafka / AWS EventBridge). Per un e-commerce di medie dimensioni: almeno 3 engineer-month dedicati a questa orchestrazione.

**Il terzo costo: la dimensione del bundle.** Headless = codice frontend custom. Catalyst di BigCommerce: 850kB JavaScript (240kB dopo gzip). Shopify Hydrogen 2.0: React Server Components, ma comunque circa 320kB. Esempio di Next.js frontend di commercetools: 950kB (aumenta se aggiungi la gestione dello stato del carrello lato client). Confronto: tema Liquid Shopify 120-180kB. Perché? HTML renderizzato lato server, JavaScript minimo.

## BigCommerce Catalyst: Il Compromesso della Via di Mezzo

BigCommerce ha introdotto Catalyst nel 2023: basato su Next.js, API Storefront GraphQL preintegrata. L'azienda lo presenta come "il meglio dei due mondi" — la velocità del monolite + la flessibilità del headless.

**I punti di forza:** In Catalyst troverai i component PLP (product listing page), PDP, carrello, checkout già pronti. Lo schema GraphQL sincronizzato con l'API Storefront. Questo significa che il frontend developer si concentra sull'UI invece di scrivere la logica del carrello da zero. Deploy: push su Vercel / Netlify, i webhook di BigCommerce triggerano il build. Tempo MVP: 8 settimane — metà di commercetools.

**I punti deboli:** La flessibilità rimane limitata. Se vuoi personalizzare completamente il checkout, sei legato all'SDK di BigCommerce. L'integrazione di provider di pagamento di terze parti (come Adyen) passa attraverso l'API REST + il control panel di BigCommerce — nessun controllo a livello di componente React. E il problema della dimensione del bundle persiste: l'installazione predefinita di Catalyst è 850kB. Se il tuo obiettivo LCP è 2.5s, questo bundle su una connessione 3G può arrivare a 4.2s (simulazione Lighthouse).

### Esempio di Codice: Ottimizzazione PLP Catalyst

```javascript
// app/[locale]/(default)/category/[slug]/page.tsx
// Catalyst predefinito carica 48 prodotti in eager mode
// Riducilo a 12 e aggiungi pagination differita

export default async function CategoryPage({ params }) {
  const products = await getProducts({
    categoryId: params.slug,
    first: 12, // 48 → 12
  });

  return (
    <div>
      <ProductGrid products={products.edges} />
      <LoadMoreButton cursor={products.pageInfo.endCursor} />
    </div>
  );
}

// client component: LoadMoreButton
'use client';
export function LoadMoreButton({ cursor }) {
  const [items, setItems] = useState([]);
  
  async function loadMore() {
    const res = await fetch(`/api/products?after=${cursor}&first=12`);
    const data = await res.json();
    setItems(prev => [...prev, ...data.edges]);
  }

  return <button onClick={loadMore}>Carica altri</button>;
}
```

Questa modifica riduce il bundle iniziale da 850kB a 620kB (riduzione del 27%). LCP: 4.2s → 2.9s. Ma rimane ancora più pesante di Shopify Liquid.

## commercetools: Massima Flessibilità, Massimo Carico

commercetools si posiziona come "truly headless". Backend API-only, zero UI component. Costruisci tutto il frontend tu — Next.js, Vue, Svelte, la scelta è tua.

**I punti di forza:** Flessibilità totale. Puoi scrivere la logica del carrello in modo custom, il flusso di checkout è completamente sotto il tuo controllo. Ad esempio, multi-valuta + calcolo imposte regionale, personalized pricing lato server (critico per B2B) — tutto interrogando l'API di commercetools. GraphQL e REST sono supportati in parallelo: usa l'endpoint che perfeziona meglio.

**I punti deboli:** Il costo iniziale è alto. I partner di implementazione commercetools quotano una MVP media a $120k-$180k (6 mesi). Metà di questo tempo va al setup backend (import catalogo prodotti, regole pricing, sincronizzazione inventario), l'altra metà al frontend. E il costo continuo: il prezzo di commercetools non è basato su transazioni ma su una fee di piattaforma — si parte da $50k annui (fascia medio-market). Hosting frontend + CDN separati (Vercel Enterprise: $2k/mese).

**Realtà di performance:** Il tempo di risposta API di commercetools è in media 120-180ms (da un server europeo, in caso di cache miss). Puoi mettere in cache su Edge (Cloudflare Workers KV / Vercel Edge Config), ma devi scrivere tu la logica di invalidazione. Esempio: il prezzo di un prodotto cambia → webhook di commercetools → Cloudflare Workers → KV purge. Questo pipeline è custom per ogni progetto.

## Shopify Plus: Composability Ibrida

Shopify con Hydrogen 2.0 entra nel mondo composable. Ma l'approccio è diverso: i temi Liquid rimangono supportati, Hydrogen è opzionale. Quindi ibrido: se serve headless lo usi, altrimenti Liquid è veloce.

**I vantaggi di Hydrogen 2.0:** Usa React Server Components — questo equilibra bene tra rendering lato server e interattività lato client. Esempio: la hero image della pagina prodotto viene renderizzata sul server (come HTML), il bottone "add to cart" è un client component (JavaScript). Risultato: bundle iniziale 320kB, LCP 1.8s (la CDN di Shopify è veloce, l'overhead RSC è basso).

**I difetti di Hydrogen 2.0:** Lo sforzo della migrazione. Se hai uno store Shopify Plus esistente e usi un tema Liquid, il passaggio a Hydrogen significa un frontend completamente nuovo. Convertire Liquid → React: 12-16 settimane. Inoltre, Hydrogen deve usare l'API Storefront 2024 — alcune variabili Liquid legacy (come `product.metafields`) richiedono un pattern di query GraphQL diverso.

**Il vantaggio di Liquid:** Rimane ancora la scelta più veloce. Perché l'HTML viene renderizzato sul server, il JavaScript è minimo. Esempio: il tema Shopify Dawn (tema Liquid predefinito): 120kB bundle, LCP 1.2s. Vale la pena la flessibilità del headless rispetto a questa velocità? La risposta dipende dal caso d'uso. Se hai bisogno di personalizzare il checkout (ad esempio, workflow di approvazione B2B), Hydrogen ha senso. Se l'esperienza di e-commerce standard ti basta, Liquid vince ancora.

### Tabella dei Tradeoff

| Criterio | Shopify Liquid | Shopify Hydrogen | BigCommerce Catalyst | commercetools |
|----------|----------------|------------------|----------------------|---------------|
| Tempo MVP | 4 settimane | 12 settimane | 8 settimane | 24 settimane |
| Dimensione bundle | 120kB | 320kB | 620kB (ottimizzato) | 400-600kB |
| LCP (3G) | 1.2s | 1.8s | 2.9s | 2.5s (con cache) |
| Flessibilità checkout | Bassa (Shopify SDK) | Media (Hydrogen checkout) | Media (SDK) | Totale |
| Costo iniziale | $15k-30k | $60k-90k | $50k-80k | $120k-180k |
| Fee piattaforma annua | ~$24k (Plus) | ~$24k + Vercel | ~$36k (Enterprise) | $50k+ |

## Su Cosa Baserai la Tua Decisione

Il composable commerce viene presentato come il "futuro", ma non si adatta a ogni progetto. I criteri decisionali vanno discussi attraverso scenari concreti.

**Scenario 1: E-commerce B2C standard, 500k-2M ordini annui.** Liquid vince. Perché il bundle è piccolo, LCP raggiunge il target, il checkout è integrato con Shopify Payments. Passare al headless aumenta il bundle di 2.5x, porta l'LCP da 1.2s a 1.8s (impatto sul tasso di conversione: perdita 0.2-0.5%). Se non hai un requisito di flessibilità che lo giustifichi, non vale la pena.

**Scenario 2: B2B wholesale, workflow di approvazione custom, pricing regionale.** commercetools ha senso. Perché le funzionalità B2B di Shopify Plus (B2B on Shopify) hanno logica di approvazione limitata. Con commercetools puoi costruire un custom cart rule engine: "ordini sopra i 10k USD richiedono approvazione procurement". La flessibilità API giustifica il ROI in questo scenario.

**Scenario 3: Store Shopify esistente, personalizzazione checkout necessaria.** Hydrogen 2.0. Perché rimani nell'ecosistema Shopify (le integrazioni di app si preservano), ma hai il controllo del checkout come componente React. Il tempo di migrazione è 12 settimane — metà di commercetools. La fee della piattaforma non cambia (già paghi Shopify Plus).

**Scenario 4: Multi-canale (e-commerce + app mobile + marketplace), headless obbligatorio.** BigCommerce Catalyst potrebbe essere una via di mezzo. Perché l'API Storefront GraphQL serve sia il web che l'app, ma il costo di integrazione non è alto come commercetools. Se l'app mobile è React Native, i component di Catalyst possono essere adattati (code sharing web → native).

## Conclusione: Accetta la Fattura della Flessibilità

L'architettura MACH offre flessibilità, ma questa flessibilità ritorna come dimensione del bundle, costo iniziale, carico di integrazione. Shopify Liquid rimane l'opzione di produzione più veloce — se il tuo scenario lo copre, passare al headless non è ottimizzazione, è over-engineering. BigCommerce Catalyst rappresenta la via di mezzo: component precostruiti + flessibilità GraphQL, ma limiti nel checkout. commercetools è flessibilità totale: $120k di avviamento + carico di orchestrazione continuativo. Hydrogen 2.0 è headless nell'ecosistema Shopify — ma più pesante di Liquid. Basa la tua decisione se il caso d'uso giustifica effettivamente i tradeoff. In produzione, i numeri vengono prima delle promesse.