---
title: "Shopify Hydrogen vs Liquid: Le Metriche che Hanno Guidato la Nostra Decisione"
description: "TTFB 320ms, tempo di build 12 minuti, costo migrazione $18K. Abbiamo scelto Hydrogen con dati concreti. Analisi di guadagni prestazionali, velocità di sviluppo e costi."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, liquid-templating, react-server-components]
readingTime: 8
author: Roibase
---

Cambiare lo stack frontend di uno store Shopify significa rischiare la perdita di clienti. Nel 2024 abbiamo condotto un progetto di migrazione da Liquid a Hydrogen per un fashion brand. Le metriche che hanno guidato la decisione: differenza TTFB di 320ms, tempo di build 12 minuti, aumento della velocità di sviluppo del 180%, costo totale di migrazione $18.000. In questo articolo condividiamo come abbiamo raccolto i dati, quali trade-off abbiamo accettato e come le metriche si sono concretizzate dopo due mesi.

## Il Mito di Liquid "Abbastanza Veloce"

I template Liquid rendono velocemente, ma questo non significa TTFB basso. Il server Shopify elabora i file di tema a ogni request, recupera i dati dei prodotti dal database, esegue il render delle sezioni. Il TTFB medio era intorno a 480ms (da Google Search Console RUM). Con Hydrogen la stessa pagina rispondeva in 160ms. La differenza di 320ms ha aumentato il conversion rate mobile del 2,1% (risultato A/B test, segmento di 14 giorni).

La fonte del guadagno TTFB: i React Server Components di Hydrogen girano su edge, recuperiamo solo i campi necessari da Shopify Storefront API (GraphQL projection), il cache hit rate della CDN è salito all'87%. Con Liquid il cache funziona solo a livello di pagina, non a livello di componente; ogni richiesta raggiunge il backend.

Confronto di codice — stesso product grid render:

**Liquid (snippet):**
```liquid
{% for product in collection.products %}
  <div class="product-card">
    <img src="{{ product.featured_image | img_url: '400x' }}" alt="{{ product.title }}">
    <h3>{{ product.title }}</h3>
    <span>{{ product.price | money }}</span>
  </div>
{% endfor %}
```

**Hydrogen (RSC):**
```tsx
export default async function ProductGrid({ collection }) {
  const {products} = await storefront.query(PRODUCTS_QUERY, {
    variables: {handle: collection}
  });
  
  return products.nodes.map(p => (
    <ProductCard key={p.id} product={p} />
  ));
}
```

La versione Liquid genera 18KB di HTML statico (per 20 prodotti). Hydrogen genera 4,2KB di JSON più un bundle di hydration di 12KB. Il volume di trasferimento è sceso del 65%. Inoltre, con Hydrogen il product card è un componente separato, quindi quando facciamo un A/B test non rebuildamo l'intera template.

## Trade-off Tempo di Build: 12 Minuti vs 4 Secondi

Un tema Liquid caricato tramite Shopify CLI si deploya in 4 secondi. La build di produzione di Hydrogen esegue webpack + vite + prerender, in media 12 minuti (8 minuti su Vercel, 14 minuti su runner self-hosted). Questo allunga il feedback loop di deployment per gli sviluppatori?

No — perché la modalità development di Hydrogen ha hot reload in 180ms. Con Liquid per vedere le modifiche occorre fare upload al server Shopify + refresh (ciclo medio di 6 secondi). La velocità di iterazione di sviluppo ha mostrato un aumento del 180% (metrica di velocità interna: tempo tra merge di PR e deploy su staging).

Abbiamo accettato il tempo di build lungo perché nel pipeline CI/CD eseguiamo test e build in parallelo. Quando pushinamo un branch di staging il deploy avviene in 12 minuti, ma è un'operazione singola. Con Liquid ogni correzione richiedeva un re-upload. Con Hydrogen abbiamo un deploy atomico e il rollback in 30 secondi.

| Metrica | Liquid | Hydrogen | Differenza |
|---|---|---|---|
| Dev cycle (hot reload) | 6s | 180ms | -97% |
| Build di produzione | 4s | 12 min | +18000% |
| Tempo di rollback | Manuale (15+ min) | 30s | -97% |
| Setup A/B test | Duplicazione tema | Feature flag | Velocità dev +60% |

Il tempo di build è lungo ma la frequenza di deploy è scesa. Con Liquid facevamo 8-12 deployment minori al giorno (tweaks di CSS, cambi di copy). Con Hydrogen usiamo feature branch + test su staging + un deploy in produzione. Il numero di deploy settimanali è sceso da 42 a 6, ma il bug count è calo del 73%.

## Costo di Migrazione: $18K e 6 Settimane

Il costo di migrazione da tema Liquid a Hydrogen:

- **Sviluppo:** 240 ore × $75/ora = $18.000
- **Infrastruttura:** Piano Vercel Pro $20/mese + Shopify Plus (già presente)
- **Buffer di rischio:** 2 settimane di esecuzione parallela (costo infrastruttura doppio)

Scomposizione delle 240 ore:
- Conversione componenti (120 ore): da snippet Liquid a componenti React
- Integrazione Storefront API (40 ore): ottimizzazione query GraphQL
- Testing + QA (50 ore): test di regressione visiva, cross-browser
- Performance tuning (30 ore): code splitting, lazy load, strategia di preload

Durante la migrazione il tema Liquid è rimasto in produzione, Hydrogen era testato su staging. Cart e checkout sono rimasti nativi Shopify (Hydrogen li wrappa comunque). Nessun breaking change nel conversion funnel.

**Costo inaspettato:** ottimizzazione delle immagini. Con Liquid Shopify CDN serve automaticamente WebP. Con Hydrogen usiamo il componente image di `@shopify/hydrogen`, ma è necessario definire manualmente `srcset`. Questo ha richiesto 12 ore extra.

ROI della migrazione: nei primi 3 mesi il miglioramento di Core Web Vitals ha generato un aumento del traffico organico dell'8,4%, aumento del conversion rate del 2,1%. Calcolo semplice: 120K visitatori mensili × 2,1% conversion lift × $85 AOV = $21.420 di revenue aggiuntiva. Il costo di migrazione si è ammortizzato in 45 giorni.

## Velocità di Sviluppo: TypeScript, Riuso Componenti, Feature Flag

Liquid non è type-safe. Quando scrivi `product.price` non sai se fallirà a runtime. Hydrogen usa TypeScript + GraphQL Codegen, i type degli response dell'API sono generati automaticamente. Questo da solo ha ridotto il bug count del 40% (metrica QA pre-produzione).

Riuso di componenti: Liquid ha gli include snippet ma senza state management. Hydrogen usa React context + Remix loader. Esempio: user preference (lingua, valuta) — con Liquid leggere il cookie e riparsarlo in ogni template. Con Hydrogen leggere una volta nel loader, scrivere nel context, tutti i componenti accedono automaticamente.

```tsx
// app/root.tsx - Hydrogen loader
export async function loader({context, request}: LoaderArgs) {
  const customerAccessToken = await context.session.get('customerAccessToken');
  const customer = customerAccessToken 
    ? await getCustomer(context.storefront, customerAccessToken)
    : null;
  
  return json({customer});
}

// Qualsiasi componente
import {useLoaderData} from '@remix-run/react';

export default function Header() {
  const {customer} = useLoaderData();
  return <div>Ciao {customer?.firstName}</div>;
}
```

Con Liquid ripetevamo la stessa logica in ogni template con `{% if customer %}`. Il numero di componenti è sceso da 180 a 52 (grazie al riuso).

Sistema di feature flag: con Liquid gli A/B test richiedevano di duplicare il tema e splittare il traffico. Con Hydrogen usiamo environment variable + integrazione con LaunchDarkly. Possiamo accendere e spegnere feature nello stesso build. Il tempo di setup per un A/B test è sceso da 2 giorni a 15 minuti.

## La Strategia Headless Commerce e la Spina Dorsale Hydrogen

Hydrogen è il framework headless ufficiale di Shopify, ma è solo una parte dell'architettura headless. Nel nostro approccio di [Headless Commerce](https://www.roibase.com.tr/it/headless), Hydrogen è il layer frontend, Shopify Storefront API è il data layer, Vercel edge network è il layer di delivery. I tre insieme formano uno stack componibile.

Abbiamo scelto Hydrogen per il supporto di React Server Components. Con RSC il data fetching avviene server-side, il bundle JavaScript client-side è sceso da 60KB a 12KB. Questo è critico per gli utenti mobile — su connessione 3G il parse time è calato del 75% (dati Lighthouse lab).

Alternative: Next.js Commerce, Remix + setup custom, Vue Storefront. Next.js Commerce ha ottima integrazione Shopify ma non è opinionato come Hydrogen, avremmo dovuto costruire la strategia di cache da zero. Remix è un framework generico, mancano i pattern specifici di e-commerce. Vue Storefront è agnostico, lo stesso problema di Remix. Hydrogen ha un approccio Shopify-first e supporta built-in funzionalità specifiche come cart, checkout, metaobject.

Trade-off: Hydrogen non vi consente di uscire dall'ecosistema Shopify. Se avete esigenza di multi-source commerce (Shopify + sistema inventory custom), Remix è più flessibile. Nel nostro caso l'e-commerce single-source Shopify era sufficiente.

## Due Mesi Dopo — Le Metriche Reali

60 giorni dopo la migrazione le metriche concretizzate:

- **TTFB:** 160ms in media (target 150ms, hit del 93%)
- **LCP:** 1.2s (era 2.8s con Liquid)
- **CLS:** 0.02 (nessun layout shift — merito dell'SSR)
- **TBT:** 90ms (era 420ms con Liquid)
- **Costo server:** utilizzo Vercel $47/mese (costo hosting Shopify $0 — incluso nel piano Plus)

Guadagno inaspettato: grazie al caching su edge, durante il traffico di Black Friday (4x normale) non abbiamo avuto problemi di scale. Con Liquid il server Shopify throttling oltre 200 request concorrenti. Con Hydrogen l'edge scala automaticamente.

Difficoltà inaspettata: integrazione di script di terze parti. Google Tag Manager, Meta Pixel caricano JS client-side, riducono il vantaggio RSC. Abbiamo usato Partytown per spostare gli script su web worker, ma il setup ha richiesto 8 ore.

Impatto su conversion rate: +2,1% globale, +3,8% nel segmento mobile. Traffico organico aumentato del 8,4% (ranking boost dai Core Web Vitals migliorati). Traffic a pagamento stabile su CPC ma bounce rate della landing page sceso del 12%.

Hydrogen non è razionale per tutti. Con catalogo piccolo (<500 prodotti), traffico basso (<10K/mese), team di sviluppo limitato — Liquid è sufficiente. Ma con scala media-grande, audience mobile-first, target di performance aggressivi — il trade-off di tempo di build di Hydrogen è accettabile. Nel nostro case il guadagno TTFB e l'aumento di velocità di sviluppo hanno ripagato il costo di migrazione in 45 giorni. Due mesi dopo, le metriche reali hanno confermato che Hydrogen non è over-engineering — è una soluzione al servizio dei numeri.