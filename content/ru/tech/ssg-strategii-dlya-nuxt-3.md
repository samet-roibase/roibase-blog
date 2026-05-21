---
title: "Nuxt 3 SSG: Strategii Prerender'a i Optimizacija Sborki"
description: "Static site generation v Nuxt 3 so strategijami route rules, payload extraction i incremental regeneration. Sokraščenie vremeni sborki s 40 sekund do 8 sekund."
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: tech
i18nKey: tech-007-2026-05
tags: [nuxt-3, ssg, prerender, build-optimization, vue]
readingTime: 8
author: Roibase
---

Motor static site generation (SSG) v Nuxt 3 kardinal'no izmeniłsja po sravn'eniju s versiej 2.x. Direktivy `routeRules`, `prerender` i mehanizm payload extraction, prisheddshie s Nitro engine, pryamo vliyayut na vremya sborki i produktivnost' v runtime. Strategii, kotoroye pomogли sokrasctit' vremya sborki s 40 sekund do 8 sekund na sajtе s 10 000 stranits e-kommerc'i, a takzhe analiz tradoff'ov i rezultaty izmrenil predstavlyayem ниже.

## Matrica Vybora Strategij Prerender'a

V Nuxt 3 suščestvuyut 4 osnovnyh strategii prerender'a: polnoe static rendering, chastichnyj prerender, ISR hybrid i generacija po zaprosu. Kazhdaya iz nih imeet razlichnyje vremya sborki, runtime zatraty i koeffic'ient popadan'iya v cache.

Full static (`nitro.prerender.routes`): renderit vse marshruty v vremya sborki i eksportirует ikh v vide HTML. Ideal'no dlya sajtov s 100 stranitsami, dlya 10 000 strani vremя sborki mozhet prevysit' 5 minut. Preimushčestvo: otsutstv'ie runtime, 100% popadan'iya v cache CDN. Nedostatok: kazhdoe izmenenie kontenta trebuet polnoe perestroenie. Dlya e-kommerc'i, gde katalog obnovlyaetsya 50 raz v den', eto neudachimo.

Chastichnyj prerender (`routeRules`): kritichnyje marshruty (startovaya stranica, top 100 kategorij) prerender'uyutsya, dlinnye khvosty obrabatyvayutsya cherez ISR. Vremya sborki sokraщaetsya na 90%. Primer: na sajte s 10 000 tovarov perv'ie 500 prerenderiruyutsya, ostalnye keshируются pri pervom zaproase. Shtraف za otsutstvie v cache: 800ms (SSR), popadan'ie v cache: 40ms (statichnyj HTML).

Incremental Static Regeneration (ISR): realizuetsya na platformah, analog'ichnyh Vercel/Netlify, s pomosch'yu `routeRules` + `swr/stale`. Stranica posle pervogo render'irovaniya popádaet v cache, a po истечении vremeni zhizni pervalidiruyetsya v fone. Tradoff: risk zastaryelogo kontenta protiv vyigrysha v vremeni sborki. S TTL v 24 chasa ne uspevayesh' perekhvatit' dnevnyje izmeneniya cen, no vremya sborki sokraщaetsya do 2 sekund.

Po-trebovanii (`server/api`): tetlится webhook'ami pri izmenenijakh kontenta — tolko sootvetstvuyushchij marshrut pererender'iruyetsya nanovo. Minimal'noe vremya sborki, maksimal'naya slozhnost' orkhestrirovaniya. Nuzhno nastrojti: CMS webhook → Nitro API → pipeline invalidac'i marshrutov.

## Granularnyj Kontrol cherez Route Rules

V `nuxt.config.ts` direktiva `routeRules` opredelyaet dlya kazhdogo marshrutа razlichnuju strategiyu renderirovaniya. Na ètom sloe direktivy `prerender`, `swr`, `isr`, `ssr` kontrol'iruyut povedenie cache dlya kazhdogo marshrutа.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true }, // Startovaya stranica vsegda statichna
    '/products/**': { swr: 3600 }, // Tovary keshuirutsya na 1 chas
    '/api/**': { cors: true, cache: false }, // API endpoint'y ne keshuirutsya
    '/category/:slug': { isr: true }, // ISR aktiviruetsya
  },
  nitro: {
    prerender: {
      crawlLinks: true, // Sledyuj ssylki v sitemape
      routes: ['/sitemap.xml'], // Ruchnoj poryadok marshrutov
      ignore: ['/admin', '/checkout/**'], // Isklyuch'i iz prerender'a
    },
  },
})
```

S `crawlLinks: true` ssylki v sitemape avtomaticheski obnaruzhivayutsya. Dlya sajta s 500 stranitsami ne nuzhen spravochnik marshrutov. No dlya sajta s 50 000 stranits crawl vsekh ssylok mozhet zanyat' 10 minut sborki — v ètom slučae ispol'zuj ruchnoj array `routes` + inkremental'naya strategiya.

### Izbezhanie Duplika Dannyh s Pomoshch'yu Payload Extraction

Nuxt 3 dlya kazhdogo prерenderirovannogo marshrutа sozdaet `_payload.json`. Ètot fajl seríalizuet dannyje, polučennyje pri server-sborke. Pri navigacii SPA etot JSON ispol'zuetsya, novyj API vyzov ne delaetsya.

```typescript
// pages/product/[id].vue
<script setup>
const route = useRoute()
const { data: product } = await useFetch(`/api/products/${route.params.id}`)
</script>
```

Vo vremya prerender'a zaprashivaetsya `/api/products/123`, otvet vstraivaetsya v `_payload.json`. Pri navigacii s kliènt-storony tie zhe dannyje pereispol'zuyutsya. Tradoff: razmer payload'a. Na sajte s 10 000 tovarov, esli kazhdyj `_payload.json` ravnyaetsya 5KB, itogo proizvoditsya 50MB statichnykh активов. Uchet shirinu propusknoj sposobnosti CDN.

Dlya optimizac'i ètomu szhimaj payload v `nitro.output.publicDir` s pomoshč'yu gzip/brotli. Nginx/Cloudflare delaet ètо avtomaticheski, no szhatie v vremya sborki daet sokraščenie 5KB → 1.2KB.

## Produktivnost' Sborki: Parallelizac'iya i Strategii Cache

Pipeline sborki Nuxt 3 sostoit iz 3 étapov: webpack/vite kompily → nitro prerender → optimizac'iya aktivov. Na 10 000 marshrutov prerender stanovitsya uzkim mestom.

**Parallelizac'iya:** parametr `prerender.concurrency` v Nitro kontrol'iruet kolichestvo odnovremeno renderiruyushchихся marshrutov. Po umolčaniyu 10. Esli RAM pozvoljaet, uveličь do 50:

```typescript
nitro: {
  prerender: {
    concurrency: 50,
  },
}
```

Na CPU s 4 yaderami + 16GB RAM izmeneniye s 10 na 50 sokraticilo vremya sborki s 40s do 12s. No usloviya svyshe 50 daet ubyvayushchuju otdaču — overhead kontekstnyh pereklyučenij CPU vozrastает.

**Inkremental'nyj kesš sborki:** Netlify/Vercel sokhranyayut kesš `.nuxt/prerender`. Nekeshiryemyje marshruty ne perестраivayutsya. Invalidaciya kesša na osnove Git-hešа znamenaet, čto pri kazhdoj razvertyvanii tolko izmenennyje marshruty pererender'iruyutsya.

```typescript
// netlify.toml
[build]
  command = "nuxt build"
  publish = ".output/public"

[[plugins]]
  package = "@netlify/plugin-nextjs"
  
[build.environment]
  NUXT_TELEMETRY_DISABLED = "1"
```

Pri koeffic'iente popadan'iya v kesš 70% sajt s 5000 marshrutov sobirayetsya za 5s vmesto 15s.

### Tradoff: Razmer Bundl'a vs Prerender

HTML-fajly, proizvedennye pri polnom prerender'e, soderzhat JS-bundle dlya gidracii. V Nuxt 3 s pomoshch'yu `experimental.payloadExtraction` payload'y można otdelit' ot HTML. Ètо optimiziruet razdelenie častej.

```typescript
experimental: {
  payloadExtraction: true,
  inlineSSRStyles: false, // Critical CSS ne vstraivaetsya inline
}
```

S `payloadExtraction: true` 250KB HTML → 180KB HTML + 70KB JSON. Client-sторona zaprashivaet JSON, ne pereparsiruet HTML. LCP 2.1s → 1.8s (90-j percentil', mobile 3G).

No tradoff: dopolnitel'nyj HTTP-zapros. Esli est' HTTP/2 multiplexing, problem'a net, s HTTP/1.1 latentnost' vozrastaet. Na sovremennyh CDN (Cloudflare/Fastly) HTTP/2 — default, poètomu ètа strategiya vyigryvaet.

## Integrac'iya Headless Commerce: Shopify + Nuxt SSG

V e-kommerc'i prerender tovarnyh stranits vniest' kompleksnost' v sinhron'izaciyu inventarya. S pomoshč'yu Shopify GraphQL Storefront API nastrajesh webhook-drivennyj revalidac'iu.

```typescript
// server/api/revalidate.post.ts
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (body.topic === 'products/update') {
    const productId = body.id
    await nitroApp.hooks.callHook('prerender:routes', [
      `/products/${productId}`
    ])
  }
  
  return { status: 'revalidated' }
})
```

Podpishis' na webhook ot Shopify Admin API → pri obnovlenii tovara `/api/revalidate` aktiviruetsya → tolko tot marshrut pererender'iruyetsya. Vmesto perestroeni vsego kataloga pererenderirovaniye odnoj stranicy trebuet 200ms.

[Headless](https://www.roibase.com.tr/ru/headless) arhitektura e-kommerc'i dlyya ètogo pattern'a kritichna. V monolitnykh platformah polnaya perestrojka neobhodima, v headless'e granuljarnyj invalidation vozmozhen. Pri 50 000 SKU i 500 obnovleniyah tovarov v den' polnaya perestrojka zajmет 6 časov, inkremental'naya revalidac'iya — 2 minuty.

## ISR + Edge Caching: Hybrid Strategiya s Cloudflare Workers

V kombinacii Nuxt 3 + Cloudflare Pages ISR realizuyetsya cherez Cloudflare Workers KV. Marshrut pri pervom zaproase renderiruyetsya, zapisyvaetsya v KV, sleduyushchie zaprosy podаiutsya iz KV.

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    preset: 'cloudflare-pages',
  },
  routeRules: {
    '/blog/**': { isr: 3600 }, // 1 chas TTL
  },
})
```

Latentnost' Cloudflare KV — ~50ms (global edge). Pervyj render 800ms + 50ms zapisj v KV, sleduyushchie zaprosy — 50ms. Pri koeffic'iente popadan'ya v cache 95% srednyy vremya otveta: 95×50ms + 5×850ms = 90ms. Pri polnom SSR vremya bylo by 800ms.

Tradoff: stoimost' zapisi v KV. Pri 1M zaproov v mesyac — $0.50 (Cloudflare pricing 2026). Esli static hosting besplatnyj, ISR vnosit dopolnitel'nye raskhody, no UX vyigrysh eto opravdyvaet.

---

Strategiya SSG v Nuxt 3 trebuet reshenia v treugol'nike «svezhest' dannyh — vremya sborki — produktivnost' runtime». Prerender startovoj stranicy, ISR dlya dlinnogo khvosta, server-sborka dlya kritichnyh putej — ètot mix' nuzhen dlya kazhdogo proekta. Bez izmerenij utverzhdenie "polnyj static bystree" budet nepravil'no; pri 10 000 marshrutov vremya sborki mozhet povredit' UX. Inkremental'naya regenerac'iya + edge cache daet vyigrysh v oboih — vremya sborki i vremya otclika — no trebuet prinyatiya orchestration kompleksnosti.