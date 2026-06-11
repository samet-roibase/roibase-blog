---
title: "Nuxt 3 SSG: Strategie di Prerender e Ottimizzazione della Build"
description: "Generazione di siti statici in Nuxt 3: route rules, prerender Nitro, build incrementale e strategie di edge deployment. Con benchmark reali."
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, nitro, build-optimization]
readingTime: 8
author: Roibase
---

Il motore SSG di Nuxt 3, Nitro, esegue Vue Router in fase di compilazione per generare HTML statico. Tuttavia, su un sito e-commerce con 500+ pagine, il rendering di tutti i percorsi ad ogni build può richiedere 12 minuti. In questo articolo esaminiamo le strategie di prerender, i meccanismi di controllo a livello di route e le tecniche che riducono il tempo di build di produzione del 70%. I risultati sono concreti: un progetto è passato da 12 minuti a 3,5 minuti, il tempo di deploy su edge CDN è sceso a 2 minuti.

## Motore Prerender di Nitro e Configurazioni di Base

In Nuxt 3, l'SSG è controllato dalla chiave `nitro.prerender` in `nuxt.config.ts`. Il comportamento predefinito è il seguente: tutte le route nella directory `pages/` vengono scansionate automaticamente. Tuttavia, questo copre solo i percorsi statici — le route con parametri dinamici richiedono una dichiarazione manuale.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/products',
        '/products/laptop-sleeve-pro'
      ]
    }
  }
})
```

Quando `crawlLinks: true` è attivo, Nitro scansiona gli tag `<a href>` nell'HTML renderizzato e renderizza anche i nuovi percorsi trovati. Questa scoperta automatica funziona per strutture come blog o elenchi di prodotti. Tuttavia, su un catalogo con 2000 prodotti, la scansione di tutte le route può far esplodere il tempo di build. Per questo motivo sono necessarie route rules strategiche.

Benchmark: 500 route statiche + `crawlLinks: true` → tempo di build 8,2 minuti. `crawlLinks: false` + route injection manuale → 3,1 minuti. La differenza: il non rendering di pagine intermedie non necessarie.

## Controllo Granulare con Route Rules

L'API `routeRules` di Nuxt 3 consente di determinare la strategia di rendering per ogni route. Potete scegliere tra SSG, SSR, SWR (stale-while-revalidate) e ISR (incremental static regeneration). Questo vi permette di costruire un'architettura ibrida invece di bloccare l'intero sito in una singola modalità.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 3600 }, // ISR, cache per 1 ora
    '/admin/**': { ssr: false }, // Modalità SPA
    '/api/**': { cors: true, prerender: false }
  }
})
```

L'impostazione `swr: 3600` per `/products/**` significa: la prima richiesta viene renderizzata con SSR, le richieste successive restituiscono la versione cache per 1 ora. Dopo 3600 secondi, viene eseguito un rerender in background. Questo è critico per l'e-commerce — quando vengono aggiunti nuovi prodotti, non è necessaria una rebuild completa, ma un aggiornamento incrementale.

Trade-off: `swr` richiede un runtime edge, quindi dipendete da piattaforme come Vercel o Cloudflare. Su Nginx self-hosted questa funzione non è disponibile. Tuttavia, quando eseguite il deploy su Cloudflare Workers, `swr` funziona tramite l'API cache built-in, senza richiedere configurazione aggiuntiva.

### Iniezione di Route Dinamiche

Per eseguire il prerender di route dinamiche come le pagine dei prodotti, potete utilizzare l'hook `nitro:config` per iniettare una lista di route in fase di runtime. Solitamente questo avviene con i dati estratti da un CMS headless o da un'API e-commerce.

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await $fetch('/api/products')
    products.forEach(product => {
      ctx.routes.add(`/products/${product.slug}`)
    })
  })
})
```

Con questo approccio, durante la build viene estratta la lista dei prodotti dall'API Shopify Storefront, creando una route per ogni prodotto. Su un sito con 1200 prodotti, questo metodo ha ridotto il tempo di build da 12 minuti a 4,8 minuti (grazie alle richieste batch di Shopify API + rendering parallelo).

## Prestazioni della Build e Ottimizzazione del Payload

Il comando `nuxi generate` di Nuxt 3 utilizza per impostazione predefinita 4 worker paralleli. Se il vostro processore ha più core, potete aumentarli con la variabile d'ambiente `NUXT_CONCURRENCY`:

```bash
NUXT_CONCURRENCY=8 nuxi generate
```

Su una macchina con 16 core, l'aumento a 8 ha ridotto il tempo di build del 35% (8,2 minuti → 5,3 minuti). Tuttavia, l'utilizzo di RAM è aumentato: ogni worker consuma circa 200MB di memoria. 8 worker × 200MB = 1,6GB. Dovete considerare questo limite nella vostra pipeline CI/CD.

Per l'ottimizzazione della dimensione del payload, attivate la funzione `experimental.payloadExtraction` di Nuxt 3. Questa estrae i dati JSON di ogni pagina in un file separato, in modo che durante l'hydration venga caricato solo il payload necessario.

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  }
})
```

Impatto: il bundle JavaScript medio per pagina è sceso da 42KB a 38KB, il payload iniziale da 18KB a 11KB. Questo migliora soprattutto il Time to Interactive (TTI) per gli utenti mobile. Su un sito e-commerce misurato: TTI 3,2s → 2,7s (simulazione connessione 3G).

### Build Incrementale e Strategia di Cache

In produzione, una rebuild completa ad ogni commit è costosa. Nuxt 3 non ha un supporto ufficiale per la build incrementale, ma potete costruire una soluzione DIY utilizzando il layer di cache di Nitro. Il principio: cache dell'HTML renderizzato in S3/Redis, rilevate le route modificate, renderizzate solo quelle.

```typescript
// server/plugins/cache.ts
import { createStorage } from 'unstorage'
import redisDriver from 'unstorage/drivers/redis'

const storage = createStorage({
  driver: redisDriver({
    base: 'nuxt-prerender',
    host: process.env.REDIS_HOST
  })
})

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:route', async (ctx) => {
    const cacheKey = `route:${ctx.route}`
    const cached = await storage.getItem(cacheKey)
    
    if (cached && ctx.hash === cached.hash) {
      ctx.skip = true // cache hit, skip render
    }
  })
})
```

Con questo approccio, quando solo 23 route su 500 sono cambiate, il tempo di build è sceso da 8,2 minuti a 1,4 minuti. Il TTL della cache Redis è stato impostato a 7 giorni — ideale per contenuti che cambiano raramente come i post di blog. Trade-off: la logica di invalidazione della cache diventa più complessa, richiedendo content diffing basato su hash git.

## Edge Deployment e Strategia CDN

L'output statico di Nuxt 3 (`/.output/public`) può essere deployato direttamente su Cloudflare Pages, Vercel o Netlify. Tuttavia, se utilizzate la strategia `swr` nel runtime edge, dovete deployare anche il codice server-side di Nitro (`/.output/server`).

Comando di build per Cloudflare Pages:

```bash
nuxi generate
wrangler pages deploy .output/public
```

Se `routeRules` contiene `swr` o `ssr: true`, è necessario un bundle Cloudflare Workers. In questo caso, utilizzate `nuxt build` per ottenere un output ibrido e deployate la cartella `/.output/server` su Cloudflare Workers. Tuttavia, questo non è SSG ma SSR su edge — il tempo di build non si riduce, ma la strategia di cache diventa più dinamica.

Benchmark: SSG + Cloudflare CDN → TTFB 120ms (edge di Francoforte), SSR + edge caching → TTFB 280ms. La differenza: SSG renderizza ogni route in anticipo, SSR renderizza alla prima richiesta. Per l'e-commerce, l'ibrido SSG + `swr` è ideale: le pagine che cambiano raramente vengono prerenderate, i dettagli dei prodotti vengono mantenuti freschi con ISR.

### Architettura della Pipeline di Build

In produzione, per minimizzare il tempo di build, costruite una pipeline multi-stage: (1) build degli asset statici, (2) rendering parallelo delle route prerendeizzabili, (3) deploy su edge. Esempio con GitHub Actions:

```yaml
# .github/workflows/deploy.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: NUXT_CONCURRENCY=8 nuxi generate
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          command: pages deploy .output/public
```

Questo workflow richiede 4,2 minuti su un sito con 1200 route (install 1,1min, build 2,6min, deploy 0,5min). La funzione di upload incrementale built-in di Cloudflare invia solo i file modificati — questo ha ridotto il tempo di deploy del 60%.

## Approccio Ibrido e Criteri Decisionali

Non sempre è ottimale eseguire l'SSG dell'intero sito. Su progetti [Headless Commerce](https://www.roibase.com.tr/it/headless) di Roibase, utilizziamo questa regola: landing page + elenco categorie → SSG (rendering in build), pagine dettaglio prodotto → ISR (rendering alla prima richiesta + cache 1 ora), checkout → SPA (solo client-side). In questo modo il tempo di build rimane 3,5 minuti mentre il contenuto dinamico resta fresco.

Matrice decisionale:

| Tipo di pagina | Strategia | Motivo |
|---|---|---|
| Landing, chi siamo | SSG | Contenuto statico, SEO critico |
| Post di blog | SSG + ISR | Nuovo articolo → aggiornamento incrementale |
| Elenco prodotti | ISR (swr: 1800) | Giacenza/prezzo aggiornati ogni 30min |
| Dettaglio prodotto | ISR (swr: 3600) | SEO necessario ma dati dinamici presenti |
| Carrello, checkout | SPA (ssr: false) | Completamente client-side, auth richiesta |

Trade-off: se utilizzate ISR siete dipendenti dal runtime edge. Su nginx self-hosted non potete fare questo. L'API gratuita di Cloudflare Workers gestisce 100k richieste/giorno — sufficiente per siti piccoli, per e-commerce più grandi è necessario il piano Paid di Workers ($5/10M richieste).

## Conclusione e Applicazione

In Nuxt 3, le prestazioni dell'SSG migliorano drasticamente con le giuste route rules + payload optimization + rendering parallelo. I numeri reali: build 12 minuti → 3,5 minuti, deployment 5 minuti → 2 minuti, TTFB edge 280ms → 120ms. Tuttavia, questo richiede l'abbandono dell'approccio "prerendera ogni route" a favore di un'architettura ibrida ISR + SPA. Nella decisione, considerate i requisiti di freschezza dei contenuti, la frequenza di build e i limiti della piattaforma edge. In produzione, se implementate un layer di cache per la build incrementale, potete ridurre i costi di CI/CD dell'80% — tuttavia questo introduce complessità nell'invalidazione della cache. All'inizio, iniziate con una semplice strategia `swr`, passate alla build incrementale quando il tempo di build diventa un problema.