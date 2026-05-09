---
title: "Shopify Hydrogen vs Liquid: I Numeri Dietro la Nostra Scelta"
description: "TTFB 840ms → 180ms, tempo build 12min → 90sec. I dati concreti della migrazione a Hydrogen, i trade-off e il calcolo del costo di migrazione."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, remix, ttfb]
readingTime: 8
author: Roibase
---

Abbiamo utilizzato i temi Liquid di Shopify per 7 anni. Quando i limiti della personalizzazione dei temi, i tempi di risposta del server fissi e i cicli di deploy monolitici hanno iniziato a vincolarci, l'espressione "headless" è arrivata al tavolo. Ma la domanda che ha bloccato la decisione era: come misuriamo il ROI della migrazione a Hydrogen? Questo articolo contiene i dettagli numerici della risposta che abbiamo trovato — TTFB, tempo di build, developer velocity, costo di migrazione. Abbiamo scelto Hydrogen perché non è solo un framework: è un guadagno di performance misurabile.

## Il Limite di Performance di Liquid

Il motore dei temi Liquid di Shopify restituisce HTML renderizzato lato server. La sintassi Liquid viene parsificata sul server, le chiamate all'API Storefront vengono eseguite, l'HTML viene assemblato e inviato al client. Questa architettura è semplice e stabile — ma ha un limite.

Nel nostro store di produzione, la mediana del TTFB era 840ms (dati RUM da Cloudflare Analytics). Il percentile 95 raggiungeva 1,4 secondi. Non possiamo controllare il tempo di risposta del server di Shopify — è infrastruttura condivisa. Anche se ottimizzassimo i file del tema Liquid (lazy load delle sezioni inutilizzate, riduzione del numero di snippet), la latenza lato server rimaneva fissa.

Il tempo di build era un problema separato. Quando modificavi un file del tema, lo pushavi tramite Shopify CLI. Il tempo medio di deploy era 12 minuti. Nella pipeline CI/CD, questo significava attendere tra stage e production. La velocità di iterazione dei test A/B era bassa. La developer velocity era limitata.

```bash
# Deploy del tema Liquid (media)
shopify theme push --store=production
⏱ Upload: 4m 20s
⏱ Processing: 7m 40s
✅ Total: 12m 00s
```

Il trade-off di Liquid è questo: configurazione semplice, zero gestione dell'infrastruttura — ma nessun controllo sulla performance, iterazione lenta.

## La Promessa Tecnica di Hydrogen

Hydrogen è il framework headless di Shopify basato su Remix. React Server Components, SSR in streaming, deploy su edge. La differenza architettonica è questa: in Liquid, il server di Shopify renderizza l'HTML. In Hydrogen, tu deploy il tuo server edge (Oxygen, Cloudflare, Vercel). Chiami l'API Storefront direttamente e trasmetti in streaming la risposta nell'albero dei componenti.

La promessa sul TTFB: poiché renderizzi da un nodo edge, la latenza del server Shopify scompare. Se fai il deploy su Cloudflare Workers, la mediana del TTFB scende tra 100-200ms (latenza del POP di Cloudflare + RTT di Storefront API). La promessa sul tempo di build: con Vite, deploy incrementale, sotto 2 minuti.

Ma accanto alle promesse c'è il costo: sforzo di migrazione, curva di apprendimento degli sviluppatori, gestione dell'infrastruttura. Abbiamo proseguito modellando questi trade-off numericamente.

### Metodologia del Benchmark

Abbiamo configurato due ambienti:
1. **Baseline Liquid:** Store di produzione, tema basato su Dawn, 80+ sezioni, proxy Cloudflare (bypass della cache)
2. **Prototipo Hydrogen:** Stesso albero di componenti della homepage, deploy su Cloudflare Workers, API Storefront versione 2024-01

Setup del test:
- WebPageTest (località Dulles, Moto G4, 3G Fast)
- Valori mediani di 3 esecuzioni
- Stato di cache fredda (flush della cache prima di ogni test)

Metriche:
- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- Tempo di build (misurato all'interno della CI/CD)

## Confronto delle Performance

I risultati (mediana su 3 esecuzioni):

| Metrica | Liquid | Hydrogen | Differenza |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **-79%** |
| **LCP** | 2.4s | 1.1s | **-54%** |
| **TBT** | 680ms | 220ms | **-68%** |
| **Tempo Build** | 12m 00s | 1m 30s | **-88%** |

La riduzione del TTFB ha rispettato le nostre aspettative. In Hydrogen, il nodo edge di Cloudflare Workers raggiunge l'API Storefront con un RTT di 40-60ms (la CDN di Shopify è già su Cloudflare). In Liquid, il server Shopify esegue il parsing di Liquid, chiama l'API, assembla l'HTML — minimo 600ms di overhead.

Il guadagno di LCP viene dall'SSR in streaming. Hydrogen invia il primo byte presto e trasmette l'HTML in streaming. Il contenuto critico (hero image, griglia di prodotti ATF) viene renderizzato prima, il contenuto below-the-fold con lazy load. In Liquid, l'HTML blocca il rendering — la pagina intera deve essere pronta prima dell'invio.

La riduzione del TBT viene dall'ottimizzazione della dimensione del bundle e dell'hydration. In Hydrogen, abbiamo utilizzato React Server Components — il bundle JavaScript lato client è 120KB (gzip). Nel tema Liquid, jQuery + script personalizzati erano 340KB. Il tempo di hydration è diminuito.

La differenza nel tempo di build ha un impatto diretto sulla developer velocity. 12 minuti invece di 90 secondi — se fai 10 deploy al giorno, risparmi 115 minuti. La pipeline CI/CD accelera, il ciclo di iterazione dei test A/B si accorcia.

```typescript
// Esempio di SSR in streaming di Hydrogen (Remix loader)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Streaming: la risposta iniziale torna subito
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

L'API `defer` trasmette le promise in streaming. Il client riceve l'HTML iniziale, la pagina si renderizza progressivamente quando i dati sono pronti. Il TTFB rimane basso.

## Calcolo del Costo di Migrazione

Il guadagno di performance è netto — ma quale il costo di migrazione? Abbiamo scomposto così:

**Sforzo di Sviluppo:**
- Migrazione componenti tema → Hydrogen: 160 ore (2 developer senior, 4 settimane)
- Integrazione API Storefront (riscrittura query GraphQL): 40 ore
- Setup pipeline CI/CD (Cloudflare Workers): 16 ore
- QA + risoluzione edge case: 24 ore
- **Totale:** 240 ore

**Costo dell'Infrastruttura:**
- Cloudflare Workers: $5/mese (gratuito fino a 100K richieste — il nostro traffico è 80K/mese)
- Oxygen (piattaforma edge di Shopify): $20/mese tier iniziale
- Abbiamo scelto Cloudflare — lo usavamo già come proxy

**Overhead di Manutenzione:**
- La versione di Hydrogen deve essere aggiornata ogni 6 mesi (monitoraggio upstream di Remix)
- Curva di apprendimento per lo sviluppatore: il team ha bisogno di esperienza con React + Remix
- In Liquid, usavamo template del Theme Store — in Hydrogen, sviluppo custom

Costo totale di migrazione una tantum: **240 ore × $80/ora = $19.200**. Costo infrastruttura annuale: **$60**.

Come abbiamo modellato i guadagni? Due capitoli:

1. **Impatto sul Conversion Rate:** La correlazione tra Core Web Vitals e conversion rate è nota (studio Google/Deloitte: riduzione LCP di 0,1s = lift del 1-2% di conversion). Il nostro LCP è sceso di 1,3s — stima conservativa di lift dell'1,5%. Su revenue mensile di $200K = $3K/mese di lift. Annuale **$36K**.

2. **Developer Velocity:** Tempo di build ridotto dell'88%. Il team fa 40 deploy al mese (CI/CD). Ogni deploy risparmi 10,5 minuti = 420 minuti al mese = 7 ore. Ipotesi sviluppatore senior $80/ora = risparmio mensile $560. Annuale **$6.7K**.

Periodo di payback: $19.200 / ($36K + $6.7K) = **5,4 mesi**.

Questi numeri giustificavano la migrazione. Il guadagno di performance + aumento della developer velocity ripagava il costo di migrazione in 6 mesi.

## Trade-off e Limiti

Hydrogen non è la scelta giusta per ogni store. In questi scenari Liquid rimane più sensato:

**Liquid dovrebbe rimanere:**
- Traffic basso (<10K/mese di visitatori) — la differenza di TTFB non impatta la conversion
- Il team non conosce React/TypeScript — la curva di apprendimento raddoppia il costo di migrazione
- Il template del Theme Store è sufficiente — non c'è bisogno di customizzazione
- Non vuoi gestire l'infrastruttura — il server condiviso di Shopify è più semplice

**Passare a Hydrogen:**
- Traffic alto (>50K/mese) — ogni 100ms di TTFB impatta la conversion
- Hai bisogno di UI/UX personalizzata — l'architettura [Headless Commerce](https://www.roibase.com.tr/it/headless) offre flessibilità
- La velocità di iterazione dei test A/B è critica — la pipeline CI/CD deve essere sotto 2 minuti
- Il team di sviluppo conosce il modern frontend stack (React/Remix)

C'è anche un costo di manutenzione in Hydrogen. Remix fa major version update ogni 6 mesi. Hydrogen la segue. In Liquid, Shopify garantisce backward compatibility — il tema vecchio funziona ancora dopo 5 anni. In Hydrogen, serve disciplina negli update delle dependency.

Il deploy su edge ha anche vincoli. I Cloudflare Workers hanno limiti runtime (CPU time 50ms, memoria 128MB). La logica backend complessa (ad esempio, motori di recommendation) non funziona su edge — devi offrirla a un origin server. In Liquid, questo non è un problema, il server lato è illimitato.

## Adesso

Abbiamo scelto Hydrogen — perché il TTFB è sceso del 79%, il tempo di build si è ridotto dell'88%, il periodo di payback è 5,4 mesi. Ma prima della decisione, abbiamo modellato il costo di migrazione e elencato i trade-off.

Se anche tu stai valutando la migrazione a Hydrogen, rispondi prima a queste domande: quanti visitatori mensili hai? Il team conosce React? Hai bisogno di UI/UX personalizzata? Hai una pipeline CI/CD? Se rispondi "sì" a queste domande, costruisci un modello numerico — converti la differenza di TTFB in lift di conversion, calcola l'aumento della developer velocity in ore. Se quei numeri giustificano il costo di migrazione, procedi.

Se stai valutando una migrazione headless come la nostra, nel nostro [Shopify Services](https://www.roibase.com.tr/it/shopify) possiamo creare una Hydrogen migration roadmap — benchmark, modello di costo, piano di rollout incrementale inclusi.