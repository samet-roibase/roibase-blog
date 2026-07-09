---
title: "Ridurre la latenza di personalizzazione a 40ms con Edge SSR"
description: "Trasferire il server-side rendering al perimetro con Cloudflare Workers e Vercel Edge riduce i tempi di personalizzazione da 120-180ms a 30-50ms. Architettura reale, esempi di codice e benchmark."
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: tech
i18nKey: tech-003-2026-07
tags: [edge-computing, ssr, cloudflare-workers, vercel-edge, kv-store]
readingTime: 8
author: Roibase
---

Nel 2026, il conflitto tra rendering lato server e personalizzazione è risolto. Quando trasferisci il processo SSR da 120-180ms su origin server a 30-50ms al perimetro edge, il calcolo cambia completamente. Cloudflare Workers opera su 300+ location edge globali, Vercel Edge su 90+ location: non è più necessario tornare all'origin per servire contenuti personalizzati all'utente. Con l'architettura KV store, mantieni lo stato dell'utente al perimetro e lo renderizzi direttamente. In questo articolo condividiamo l'implementazione pratica di questa architettura, i tradeoff e i risultati dei benchmark.

## La differenza tra Edge SSR e SSR classico

Nello SSR classico, la richiesta del browser va al server origin, il runtime Node.js/Deno renderizza l'HTML, la risposta torna indietro. Il TTFB medio (Time to First Byte) da Istanbul a Frankfurt è 60-80ms, il tempo di rendering è 40-120ms, totale 100-200ms. Con Edge SSR, la richiesta cade nel nodo edge più vicino, il rendering avviene lì, TTFB è 10-20ms, rendering 20-40ms, totale 30-60ms.

La differenza non è solo latenza di rete — i runtime edge eseguono su isolate V8, quindi lo startup time è prossimo a zero. Su origin, anche senza cold start di container, c'è process spawning e overhead. Al perimetro, l'isolate è già pronto, il codice si esegue immediatamente.

Il punto critico per la personalizzazione: dove recuperi i dati utente. Su origin li prendi da database o Redis (10-30ms). Al perimetro, dal KV store (1-5ms). KV store è eventually consistent, read latency a singola cifra in millisecondi, replica globale. Cloudflare Workers KV o Vercel KV — entrambi lo stesso pattern: write va a origin (50-100ms), read viene dal perimetro (1-5ms). Per scenari di personalizzazione read-heavy (preferenze utente, informazioni di segment, comportamento storico), questa architettura è molto efficace.

### Scenario di confronto TTFB

| Architettura | TTFB | Rendering | KV Read | Totale |
|---|---|---|---|---|
| Origin SSR (Frankfurt) | 60-80ms | 40-120ms | 10-30ms | 110-230ms |
| Edge SSR (Cloudflare) | 10-20ms | 20-40ms | 1-5ms | 31-65ms |
| Edge SSR (Vercel) | 15-25ms | 25-45ms | 2-6ms | 42-76ms |

Questi numeri sono misurati da Istanbul, dati RUM (Real User Monitoring). Nei test in laboratorio escono ancora meglio, ma in production ci sono fattori come jitter di rete e contention di compute.

## Architettura KV Store con Cloudflare Workers

Su Cloudflare Workers, i blocchi costruttivi per Edge SSR sono: runtime Workers (isolate V8), namespace KV (key-value store eventually consistent), HTMLRewriter (API di trasformazione HTML basata su stream). I framework classici (Next.js, Nuxt, SvelteKit) non girano completamente perché dipendono dalle API Node.js. Invece usi Remix (con adapter Cloudflare), Qwik (supporto edge nativo), o una pipeline SSR personalizzata.

Scenario pratico: sito e-commerce, vuoi mostrare agli utenti un banner "Torna al tuo carrello" sulla homepage con i prodotti che avevano aggiunto in precedenza. Con SSR classico quell'informazione viene dal session store (Redis/Memcached), iniettata nell'HTML renderizzato. Con Edge SSR la stessa informazione viene dal KV:

```javascript
// cloudflare worker
export default {
  async fetch(request, env) {
    const userId = getCookie(request, 'user_id');
    const cartData = await env.CART_KV.get(`cart:${userId}`, { type: 'json' });
    
    const html = await renderApp({
      cartItems: cartData?.items || [],
      showBanner: cartData?.items?.length > 0
    });
    
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
};
```

In questo esempio, la chiamata `env.CART_KV.get()` richiede 1-5ms. La funzione `renderApp()` produce una stringa HTML (motore template o framework render). Tempo totale di esecuzione 25-40ms. Se lo stesso lavoro venisse fatto su origin, il roundtrip Redis sarebbe 10-30ms, totale 50-150ms.

### Strategia KV Write

Le scritture KV vanno a origin, questo è 50-100ms. Perciò durante l'azione utente (aggiungi al carrello) questa latenza è accettabile — è comunque una richiesta POST, l'utente aspetta. Ma la lettura (caricamento pagina, leggere lo stato carrello) deve sempre essere dal perimetro. Il path di scrittura è così:

```javascript
// POST /cart/add handler (origin o edge)
async function addToCart(userId, productId) {
  const cart = await env.CART_KV.get(`cart:${userId}`, { type: 'json' }) || { items: [] };
  cart.items.push({ productId, addedAt: Date.now() });
  
  await env.CART_KV.put(`cart:${userId}`, JSON.stringify(cart), {
    expirationTtl: 604800 // 7 giorni
  });
  
  return cart;
}
```

La chiamata `put()` è eventually consistent — ritorna subito ma la replica può richiedere 60 secondi. Quindi l'utente aggiunge un prodotto, ricari la pagina, entro 60 secondi cade su un nodo edge diverso, potrebbe vedere il carrello vecchio. Per la maggior parte dei casi è accettabile; se critico, aggiungi un fallback pattern (se KV miss, interroga origin).

## Vercel Edge Functions e alternativa Durable Objects

Vercel Edge Functions è anche basato su isolate V8, un fork di Cloudflare Workers. Per il KV store usi Vercel KV (API compatibile Redis ma architettura KV dietro le quinte). L'API è un po' diversa:

```javascript
// vercel edge function (app/api/render/route.js)
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request) {
  const userId = request.cookies.get('user_id')?.value;
  const cartData = await kv.get(`cart:${userId}`);
  
  const html = renderToString(<App cartItems={cartData?.items || []} />);
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' }
  });
}
```

La latenza di lettura Vercel KV è 2-6ms (un po' più lenta del KV Cloudflare ma ancora a singola cifra). La latenza di scrittura è simile: 50-100ms. Se usi Next.js 13+ con App Router, puoi selezionare il runtime `edge`, in quel caso tutto il rendering server component avviene al perimetro.

Un vantaggio ulteriore di Cloudflare: Durable Objects. KV è eventually consistent, Durable Objects sono strongly consistent, fanno coordinamento single-region. Li usi per collaborazione real-time, seat locking, inventario. Non serve per la personalizzazione ma in un'architettura [commerce headless](https://www.roibase.com.tr/it/headless) come il checkout flow, è preferibile per i punti critici.

### Pattern ibrido Edge SSR + Static

Non ogni pagina deve essere renderizzata al perimetro. Pagine come homepage con traffico alto e personalizzazione bassa possono essere build statiche e tenute su CDN. Le sezioni user-specific vengono riempite via fetch client-side (simile a ESI). Edge SSR lo usi solo per pagine come carrello, account, PDP (product detail page — se mostri cronologia utente).

Strategia Next.js di esempio:

```javascript
// next.config.js
module.exports = {
  experimental: {
    runtime: 'experimental-edge' // per specifiche rotte
  }
};

// app/account/page.js
export const runtime = 'edge';

// app/page.js
// se runtime non è specificato, default Node.js SSR o static
```

Questo pattern ibrido è ottimale per Core Web Vitals. Pagine statiche hanno LCP 1.5s, pagine Edge SSR 2.5s (il tempo di iniezione contenuto personalizzato aggiunge). Ma sempre molto meglio dell'origin SSR a 4-5s.

## Tradeoff e limitazioni

Il runtime edge non è Node.js completo — no `fs`, `child_process`, nessun modulo nativo. Le operazioni CPU-heavy (crittografia, compressione) sono limitate (CPU time limit: Cloudflare 50ms, Vercel 30s ma praticamente 100ms è il target). Limite bundle size: Cloudflare 1MB (compresso), Vercel 4MB. I framework grandi (Next.js runtime completo) non entrano, usi alternative lean come Remix.

KV store è eventually consistent — leggere subito dopo scrivere non è garantito. Se serve strong consistency (checkout, payment), devi tornare a origin oppure usare Durable Objects (aggiunge anche latenza, 15-30ms).

Costo: Cloudflare Workers plan gratuito 100K request/giorno, KV 1GB gratis. Dopo è $5/10M request, KV $0.50/GB. Vercel Edge Functions plan Hobby 100K invocation/mese, Pro plan unlimited (fair use). Se in production hai milioni di request/giorno, il costo aggiuntivo è $50-200 al mese. Paragonato a Origin SSR, il costo di compute è basso (serverless, pay-per-use) ma c'è il costo di KV storage e bandwidth.

### Debug e monitoring

Testare l'ambiente edge localmente è difficile. Cloudflare `wrangler dev`, Vercel `vercel dev` fanno emulazione locale ma il comportamento production non è identico. I log degli errori vengono streamati dal perimetro, non appaiono immediatamente come `console.log` su origin. I tool RUM (Sentry, Datadog) supportano il runtime edge ma il setup è diverso.

Quando fai benchmark, nota: nei test lab (Lighthouse, WebPageTest) la differenza origin vs edge è più marcata perché posizione fissa, rete ideale. Nei test utenti reali (RUM, Chrome UX Report) la varianza è maggiore — rete mobile, lookup DNS, TLS handshake. Nei nostri deployment production, origin SSR Istanbul-Frankfurt TTFB medio era 140ms mentre Cloudflare Edge SSR medio era 42ms (70% riduzione). Ma al P95 la differenza è minore: 220ms vs 85ms (60% riduzione). Al perimetro senza cold start, la differenza P95 - median è molto piccola.

## Applicazione nel mondo reale: personalizzazione e-commerce

Scenario concreto: sito e-commerce in Turchia con 500K+ sessioni giornaliere. Homepage, categoria, PDP sono personalizzate (prodotti visti recentemente, raccomandazioni, banner basati su segment). Con Origin SSR il TTFB era 120-180ms, LCP 2.8-4.2s. Dopo la migrazione a Cloudflare Workers + KV, TTFB è 35-55ms, LCP 1.9-2.6s.

Cambiamento architetturale:
1. Sessione utente spostata su KV (era su Redis)
2. Output del motore di raccomandazione prodotti cache su KV (TTL 300s, per segment utente)
3. HTML homepage renderizzato nel Worker (template personalizzato invece di React SSR, 15ms vs 60ms)
4. CSS critico inline, hint di preload font iniettati dal Worker

La complessità del codice è aumentata — motore template personalizzato, debug difficile. Ma il guadagno di performance è netto: Web Vitals mobili Core aumentati del 32% (Google Search Console), conversion rate +4.2% (same-period comparison). Non puoi attribuire direttamente il cambio di conversion a performance web, ma il timing corrisponde.

Un altro esempio: sito Shopify headless (Hydrogen framework, basato su Remix). La chiamata API Shopify Storefront da origin è 80-120ms, dal perimetro (Cloudflare Workers più vicino al Shopify POP) è 30-50ms. La pagina di listing prodotti mostra 8 prodotti, ogni uno con API call parallela — su origin totale 120ms, al perimetro 50ms. Così il caricamento della PDP è sceso da 3.2s a 1.8s.

## Meccanismo decisionale: quando usare Edge SSR

Non ogni progetto deve migrare a Edge SSR. I vettori di decisione:

**Preferisci Edge SSR quando:**
- Personalizzazione read-heavy (profilo utente, segment, preferenza)
- User base globale (sensibilità alla latenza alta)
- Traffico elevato (tradeoff costo/performance favorevole)
- Tolleranza stack moderno (nessuna dipendenza da API Node.js)

**Origin SSR rimane quando:**
- Flow write-heavy (checkout, creazione ordine — consistency richiesta)
- Dipendenza backend complessa (database, API terze, compute pesante)
- Codebase legacy (costo migrazione elevato)
- Traffico basso (giustificazione premium edge difficile)

L'ibrido è il più realistico: homepage, listing, PDP al perimetro; carrello, checkout, dettaglio account su origin. Così l'esperienza personalizzata è veloce, la transazione critica rimane sicura. Architetturalmente, la funzione edge può fallback a origin — se KV miss o timeout, origin SSR entra in gioco, l'esperienza utente non si interrompe.

Edge SSR non è l'ultimo anello della performance marketing, ma quando controlli la latency, emergono altre cose da ottimizzare: bundle size, hydration cost, CLS. Questi temi sono l'intersezione tra UI/UX e frontend engineering — nei nostri progetti commerce headless, integrare questo è parte del flusso standard. Trasferire al perimetro riduce il tempo di rendering, ma l'esecuzione JavaScript client-side rimane determinante su TBT (Total Blocking Time) e INP (Interaction to Next Paint). Per risolverlo devi entrare in pattern come island architecture e partial hydration. Questo è un altro articolo.