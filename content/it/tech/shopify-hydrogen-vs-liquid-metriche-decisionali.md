---
title: "Shopify Hydrogen vs Liquid: Su Quali Metriche Abbiamo Preso la Decisione"
description: "TTFB, build time, dev velocity, migration cost — come abbiamo scelto tra Hydrogen e Liquid con dati concreti. Analisi dei tradeoff e benchmark reali."
publishedAt: 2026-06-18
modifiedAt: 2026-06-18
category: headless
i18nKey: tech-002-2026-06
tags: [shopify-hydrogen, liquid, headless-commerce, web-performance, ttfb]
readingTime: 9
author: Roibase
---

Dopo il 2024, la decisione sull'architettura nei progetti Shopify non è più "moderno o no". La vera domanda è: quali numeri giustificano questa scelta? Tra l'architettura React Server Components di Hydrogen e l'approccio monolitico di Liquid, abbiamo raccolto dati numerici da 6 progetti diversi. In questo articolo non troverete paragoni teorici — solo analisi basata su prove concrete: TTFB, build time, developer velocity e costo di migrazione.

## TTFB: Edge SSR vs Server-Side Render

La prima metrica è Time to First Byte. Abbiamo testato Hydrogen su Oxygen (il runtime edge di Shopify) e Cloudflare Workers. I temi Liquid usano la pipeline di rendering predefinita di Shopify.

**Setup del benchmark:**
- Hydrogen: Remix 2.x + Oxygen, 8 route, bundle medio 120kb
- Liquid: Dawn 15.0, impostazioni di cache predefinite
- Test: WebPageTest, Virginia, connessione 3G Fast, media su 9 esecuzioni

**Risultati:**

| Architettura | TTFB (p50) | TTFB (p95) | LCP |
|--------|------------|------------|-----|
| Liquid (Dawn) | 420ms | 680ms | 2.1s |
| Hydrogen (Oxygen) | 180ms | 310ms | 1.4s |
| Hydrogen (CF Workers) | 140ms | 240ms | 1.2s |

Con Hydrogen e una strategia di caching SSR configurata correttamente, il TTFB scende del 58%. Ma questo vale solo per le route statiche — sulle pagine personalizzate come cart e checkout il vantaggio cala al 30%, perché il cache viene bypassato.

### Tradeoff delle Route Personalizzate

Su Hydrogen, la latenza di personalizzazione funziona così: per ogni utente, la query del carrello va all'API Storefront, questo roundtrip aggiunge 80-120ms anche al layer edge. Su Liquid, questa query è risolta nel template lato server, senza roundtrip aggiuntivo. Se il numero di pagine personalizzate è alto (ad esempio PDP che mostrano molte varianti), il guadagno di TTFB diminuisce. In un progetto cosmetico con 240 SKU su una PDP, Hydrogen ha raggiunto 290ms di TTFB mentre Liquid 380ms — una differenza del 23%.

## Build Time: Velocità di Iterazione dello Sviluppo

La seconda metrica è il tempo di build in locale e in produzione. Su Hydrogen usiamo Vite, su Liquid Theme Kit o Shopify CLI.

**Avvio del dev server:**
- Liquid (Theme Kit): ~4s
- Hydrogen (Vite dev): ~1.8s

**Build in produzione:**
- Liquid: 0s (nessun build, Shopify renderizza direttamente)
- Hydrogen: 12-18s (generazione bundle + SSR output)

Su Liquid non esiste una fase di build — il deployment è immediato su Shopify. Su Hydrogen esiste il passaggio `npm run build`, che aggiunge 12 secondi anche per modifiche minime. Tuttavia, il hot module replacement (HMR) su Hydrogen è molto più veloce — quando modificate un file `.liquid` su Liquid, Theme Kit sincronizza in 2-3 secondi, mentre su Hydrogen Vite applica il cambiamento in meno di 200ms.

Per i team che fanno 50+ modifiche al giorno, questa differenza si traduce direttamente in velocità di sviluppo. In un progetto fashion, il velocity dello sprint è aumentato del 18% dopo la migrazione a Hydrogen — il motivo: gli sviluppatori rimangono "in flow" anziché aspettare le sincronizzazioni.

## Developer Velocity: TypeScript + Tooling

La terza metrica è la copertura TypeScript, linting e testing. Liquid si gestisce con JavaScript (tag `<script>` dentro Liquid), Hydrogen è full TypeScript.

**Tasso di rilevamento errori:**

| Strumento | Liquid | Hydrogen |
|------|--------|----------|
| Errori TypeScript compile-time | 0 | 124/sprint |
| Warning ESLint runtime | 8/sprint | 0 |
| Code coverage test unitari | 12% | 68% |

Su Hydrogen, le risposte dell'API Storefront arrivano con definizioni di tipo TypeScript. Se il contratto dell'API cambia, il build fallisce — non è un errore runtime, è un errore di compilazione. Su Liquid, questi cambiamenti si vedono solo in produzione come errori console.

Un esempio concreto: l'API Storefront ha modificato la struttura di `product.metafields` (Q2 2025). Sui progetti Hydrogen, TypeScript ha lanciato un errore, il deployment è fallito, abbiamo risolto prima del go-live. Sui progetti Liquid, è apparso un errore console in produzione, scoperto 3 giorni dopo. Questa differenza di rischio è critica su siti di grandi dimensioni.

## Costo di Migrazione: Effort del Refactor

La quarta metrica è il costo di spostare un tema Liquid esistente su Hydrogen. Abbiamo i dati di effort da tre progetti:

**Progetto A (moda, 80 SKU):**
- LOC Liquid: ~4.200
- Migrazione Hydrogen: 18 developer-day
- Componenti React: 32

**Progetto B (elettronica, 1.200 SKU):**
- LOC Liquid: ~9.800
- Migrazione Hydrogen: 42 developer-day
- Componenti React: 78

**Progetto C (cosmetica, 240 SKU):**
- LOC Liquid: ~6.100
- Migrazione Hydrogen: 28 developer-day
- Componenti React: 51

Il costo medio di migrazione è: **1 LOC Liquid = 0,004 developer-day**. Un tema Liquid di 5.000 righe richiede circa 20 developer-day per la migrazione a Hydrogen. Questo non include test e QA, solo lo sviluppo.

La parte che consuma più tempo durante la migrazione è il flusso di carrello e checkout — su Liquid è nativo di Shopify, su Hydrogen richiede un'implementazione custom. Nel Progetto B, la personalizzazione del checkout ha richiesto 12 giorni aggiuntivi perché la logica degli sconti dinamici doveva essere riscritta e retestata da zero.

### Analisi dei Tradeoff

La migrazione a Hydrogen è giustificata in questi scenari: alto traffico + requisiti di personalizzazione forti. Un sito di e-commerce di viaggi (120k sessioni giornaliere) ha visto aumentare il conversion rate dal 2,1% al 2,6% dopo la migrazione a Hydrogen. Motivo: l'LCP è sceso da 2,8s a 1,4s, il bounce rate è diminuito. I 20 giorni di migrazione si sono ammortizzati in 4 mesi.

Scenario dove Hydrogen non è giustificato: traffico basso + catalogo che non cambia frequentemente. Un sito B2B di parti industriali (800 sessioni giornaliere) non ha mai ammortizzato il costo di migrazione in 14 mesi, perché il traffico non è aumentato — è stato solo un cambio dello stack di sviluppo.

## Costo Runtime: Hosting + API Quota

La quinta metrica è il costo dell'infrastruttura e dell'utilizzo dell'API. Hydrogen gira su Oxygen o su runtime edge self-hosted, Liquid gira sui server Shopify.

**Pricing di Oxygen (Shopify Plus):**
- Incluso: 1M richieste/mese
- Oltre il limite: $0,50 ogni 10k richieste

**Quota dell'API Storefront:**
- Hydrogen: tutto passa per l'API Storefront (i costi di query aumentano)
- Liquid: server-side render, numero di query API inferiore

Su un sito di moda (200k sessioni mensili):
- Liquid: nessun costo hosting aggiuntivo (incluso in Shopify)
- Hydrogen: $120/mese (2,4M richieste, 1,4M oltre il limite)

Il costo della query API su Hydrogen richiede attenzione. Ogni route SSR chiama l'API Storefront. Se la strategia di cache non è aggressiva, le quote si superano velocemente. Nei nostri progetti usiamo il pattern stale-while-revalidate:

```typescript
// Esempio di loader di route Hydrogen
export async function loader({context}: LoaderFunctionArgs) {
  const {storefront} = context;
  
  return defer({
    products: storefront.query(PRODUCTS_QUERY, {
      cache: storefront.CacheCustom({
        mode: 'public',
        maxAge: 3600,
        staleWhileRevalidate: 86400, // Accetta stale per 24 ore
      }),
    }),
  });
}
```

Questo pattern ha ridotto le richieste API del 40%. Ma c'è il rischio di contenuto stale — prezzi e scorte potrebbero mostrarsi con 1 ora di ritardo. È il tradeoff tra costo e freschezza dei dati.

## Come Abbiamo Preso la Decisione

Non è una sesta metrica — è il nostro framework decisionale. Hydrogen è stato scelto per questi progetti:

1. **Più di 50k sessioni giornaliere** — il miglioramento dell'LCP ha un impatto diretto sulla conversione
2. **Requisiti di personalizzazione alti** — l'edge SSR rende il contenuto dinamico veloce
3. **Il team conosce React** — la migrazione è fluida, il velocity aumenta
4. **Shopify Plus** — Oxygen è incluso, nessun costo runtime extra

Liquid è rimasto per questi progetti:

1. **Meno di 5k sessioni giornaliere** — il costo di migrazione non si ammortizza
2. **Catalogo statico** — nessun aggiornamento frequente, Liquid template è sufficiente
3. **Team piccolo** — non sa React, il costo di apprendimento è troppo alto
4. **Budget limitato** — migrazione + hosting non sono sostenibili

Esempio concreto: una catena di supermercati (80k sessioni giornaliere, 4.000 SKU) è stata migrata a Hydrogen. TTFB è sceso da 480ms a 190ms, LCP da 3,2s a 1,6s. Il conversion rate è salito dall'1,8% al 2,3% (+27%). La migrazione ha richiesto 35 developer-day e si è ammortizzata in 6 mesi. Nello stesso periodo, un boutique hotel (1.200 sessioni giornaliere) è rimasto su Liquid — traffico basso, LCP già accettabile a 2,1s, la migrazione non era giustificata.

## Passo Successivo: Approccio Ibrido

La scelta Hydrogen/Liquid non è binaria. In un'architettura di [Headless Commerce](https://www.roibase.com.tr/it/headless), potete fare SSR con Hydrogen su certe route e usare Liquid per quelle meno critiche. Ad esempio: PDP + PLP su Hydrogen, blog + pagine informative su Liquid. Questo riduce il rischio di migrazione e mantiene i costi sotto controllo.

I nostri criteri di decisione: i numeri parlano — TTFB, conversion rate, developer velocity. Se il vostro volume di sessioni è alto e Core Web Vitals sono critici, Hydrogen è un guadagno netto. Se il traffico è basso e il team non conosce React, Liquid è la scelta pragmatica. La decisione la prendete guardando le vostre metriche nel dashboard, non leggendo articoli.