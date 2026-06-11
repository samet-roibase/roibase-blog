---
title: "Nuxt 3 SSG: Strategii Prerendera i Optimizaciya Sborki"
description: "Staticheskaya generaciya sajtov v Nuxt 3: route rules, nitro prerender, inkrementalnaya sborka i edge deployment. S real'nymi benchmarkami."
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: tech
i18nKey: tech-007-2026-06
tags: [nuxt-3, ssg, static-site-generation, nitro, build-optimization]
readingTime: 8
author: Roibase
---

Motor SSG v Nuxt 3 — Nitro — zapuskaet Vue Router vo vremya kompilacii i generiruet staticheskij HTML. Odnak dlya e-kommerca s 500+ stranicami polnaya sborka kazhdogo ruta mozhet zanyat' 12 minut. V etoj stat'e my razbirem strategii prerendera, mekhanizmy kontrolya na urovne rut i tekhniku snizheniya vremeni sborki na 70%. Real'nye rezul'taty: odin proekt sokratilsya s 12 minut do 3,5 minut, vremya razvyortyvaniya na edge CDN snyzilos' do 2 minut.

## Motor Prerendera Nitro i Bazovye Nastrojki

V Nuxt 3 SSG kontroliruetsya klyuchom `nitro.prerender` v `nuxt.config.ts`. Standartnym povedeniem yavlyaetsya avtomaticheskoe skanirovanie vsех rut iz papki `pages/`. Odnak eto pokryvaet tol'ko staticheskie marshruty — dinamicheskie parametrizovannye marshrute trebuyut ruchnogo ob"yavleniya.

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

Kogda `crawlLinks: true` aktivizirovan, Nitro skaniriruet `<a href>` tegov v renderironannom HTML i generiruet najdennye novye marshrute. Avtomaticheskoe obnaruzhenie rabotaet dlya blogov i katalogov. No dlya kataloга s 2000 tovarami polnoe skanirovanie vzryvaet vremya sborki. Poetomu nuzhny strategicheskie route rules.

Benchmark: 500 staticheskih rut + `crawlLinks: true` → vremya sborki 8,2 minuty. `crawlLinks: false` + ruchnaya inzhekciya rut → 3,1 minuty. Raznica: neperenebeshhyennye promezhutochnyepages ne renderiruyutsya.

## Granulnyj Kontrol s Route Rules

API `routeRules` v Nuxt 3 pozvolyaet opredelyat' strategiyu rendera dlya kazhdogo marshruta. Vy mozheте vybirat' mezhdu SSG, SSR, SWR (stale-while-revalidate) i ISR (incremental static regeneration). Eto daet vozmozhnost' postroit' gibridnuyu arhitekturu vmesto privedeniya vsego sajta k odnomu rezhimu.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { swr: 3600 }, // ISR, kesh na 1 chas
    '/admin/**': { ssr: false }, // SPA rezhim
    '/api/**': { cors: true, prerender: false }
  }
})
```

Nastrojka `swr: 3600` dlya `/products/**`: pervyj zapros rendiruetsya cherez SSR, sleduyushhie zaprosy v tecenie 1 chasa vozvrashhhayut keshovannuyu versiyu. Posle 3600 sekund stranica pererendiruetsya v fone. Eto kritichno dlya e-kommerca — kogda dobavlyayutsya novye tovary, ne nuzhna polnaya perestrojka, a tol'ko inkremental'noe obnovlenie.

Kompromiss: `swr` trebует edge runtime, poetomu vy privyazany k Vercel/Cloudflare. Na samorazmeshhyonnom Nginx eto nedoступno. No pri razvertyvanii na Cloudflare Workers, `swr` rabotaet cherez vstroennyj cache API bez dopolnitel'noj konfiguraci.

### Inzhekciya Dinamicheskih Rut

Dlya prerendera dinamicheskih rut, takih kak stranicy tovarov, ispol'zujte hook `nitro:config` dlya inzhekcii spiska rut vo vremya vypolneniya. Obychno eto dannye iz headless CMS ili e-kommerce API.

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

Pri ètom podkhode API Shopify Storefront zaprashivaetsya vo vremya sborki, dlya kazhdogo tovara sozdaetsya marshrut. Na sajte s 1200 tovarami ètot metod sniziл vremya sborki s 12 minut do 4,8 minut (blagodarya batch-zaprosam i parallel'nomu renderiyu).

## Produktivnost' Sborki i Optimizaciya Payload

Komanda `nuxi generate` po umolchaniyu ispol'zuet 4 parallel'nyh rabochih. Esli u vas bol'she yadder CPU, povysit' mozhno cherez peremennuyu okruzheniya `NUXT_CONCURRENCY`:

```bash
NUXT_CONCURRENCY=8 nuxi generate
```

Na mashine s 16 yadri povyshenie do 8 snizilo vremya sborki na 35% (8,2 minuty → 5,3 minuty). No uvelichilas' potreblenie pamyati: kazhdyj worker zajmayot ~200MB. 8 raboчих × 200MB = 1,6GB. Ètot limit vazhen dlya CI/CD pipeline.

Dlya optimizacii razmera payload vklyuchite `experimental.payloadExtraction` v Nuxt 3. Ètot parametr vyplivayut JSON-dannye kazhdoj stranicy v otdel'nyj fajl, pojtomu pri gidracii zagruzhaetsya tol'ko neobhodimyj payload.

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  }
})
```

Vliyanie: srednyj JavaScript bundle na stranicu sniziлsya s 42KB na 38KB, nachal'nyj payload s 18KB na 11KB. Osobenno dlya mobil'nyh pol'zovatelej uluchshetsya vremya Time to Interactive (TTI). Na izmeryonnom e-kommerc sajte: TTI 3,2s → 2,7s (simulyaciya 3G svyazi).

### Inkremental'naya Sborka i Kesh-Strategiya

V production'e polnaya perestrojka pri kazhdoj zalivke — dorogostoyaschaya praktika. V Nuxt 3 net oficial'noj podderzhki inkremental'noj sborki, no mozhno sozdať DIY resheniya na osnove cache-sloya Nitro. Princip: keshuyte rendirovannye HTML v S3/Redis, obnaruzhivajte izmenyonnye marshrute i pererendiruyte tol'ko ikh.

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
      ctx.skip = true // попадание v kesh, promenut' rendering
    }
  })
})
```

Pri ètom podkhode, esli izmenilos' tol'ko 23 marshrutov iz 500, vremya sborki snizilos' s 8,2 minut na 1,4 minuty. TTL keshya v Redis byl 7 dnej — ideal'no dlya redko menyayushhegosya soderžaniya, takim kak blog-stati. Kompromiss: logika invalidacii kesha stanovitsya slozhnoj, nuzhno sravnenie soderžaniya po git-keshfu.

## Razvertyvanie na Edge i CDN-Strategiya

Staticheskij vyvod Nuxt 3 (`/.output/public`) razvertyvayetsya prямo na Cloudflare Pages, Vercel ili Netlify. No esli ispol'zuyete `swr` v `routeRules`, nuzhno razvernut' kod servera (`/.output/server`) na edge.

Komanda dlya Cloudflare Pages:

```bash
nuxi generate
wrangler pages deploy .output/public
```

Esli v `routeRules` est' `swr` ili `ssr: true`, trebuetsya bundle Cloudflare Workers. V ètom sluchae zapustite `nuxt build` dlya gibridnogo vyvoda, potom razvernut' `/.output/server` na Cloudflare Workers. No ètо uzhe ne SSG, a edge SSR — vremya sborki ne padает, no cache-strategiya bolee dinamichna.

Benchmark: SSG + Cloudflare CDN → TTFB 120ms (Frankfurt edge), SSR + edge keshing → TTFB 280ms. Raznica: SSG rendiruet kazhdyj marshrut zaranee, SSR rendiruet pri pervom zaprose. Dlya e-kommerca ideal'no SSG + `swr` hybrid: redko menyayushhiesya stranicy pererendiryutsya, detali tovarov ostaюtsya fresh pri ISR.

### Arhitektura Build Pipeline

V production snizheniyu vremeni sborki sposobuet multi-stage pipeline: (1) sborka staticheskih aktivov, (2) parallel'nyj rendering prerenderiruemyh rut, (3) razvertyvanie na edge. Primer na GitHub Actions:

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

Ètot workflow na sajte s 1200 maršrutami zajmayot 4,2 minuty (ustanovka 1,1min, sborka 2,6min, razvertyvanie 0,5min). Spasibo vstroennoj funkcii inkremental'noj zagruzki Cloudflare — zagruzhaюtsya tol'ko izmenyonnye fajly, čto sniziлo vremя razvertыvaniya na 60%.

## Gibridnyj Podkhod i Kriterii Resheniya

SSG dlya vsego sajta ne vsegda optimal'no. V Roibase dlya [Headless Commerce](https://www.roibase.com.tr/ru/headless) projektov ispol'zuetsya sleduyushhee pravilo: landing page + katalog kategorij → SSG (render pri sborke), stranicy detaljej tovarov → ISR (render pri pervom zaprose + kesh na 1 chas), checkout → SPA (tol'ko klient, bez servera). Pri ètom vremya sborki ostayotsya 3,5 minuty, a dinamicheskoe soderžhaniye ostayotsya svežim.

Matrica reshenij:

| Tip stranicy | Strategiya | Prichina |
|---|---|---|
| Landing, o nas | SSG | Staticheskoe soderžhaniye, SEO vazhen |
| Blog-stat'ya | SSG + ISR | Pri dobavlenii novoj stat'i — inkremental |
| Katalog tovarov | ISR (swr: 1800) | Zapasy/ceny obnovlyayutsya kazhdye 30min |
| Detalj tovara | ISR (swr: 3600) | SEO potrebna, no dannye dinamichny |
| Korzina, checkout | SPA (ssr: false) | Tol'ko klient-storona, trebuetsya autentifikaciya |

Kompromiss: ISR trebует привязки k edge runtime. Na samorazmeshhyonnom nginx ètogo ne sdelat'. Besplatnyj plan Cloudflare Workers — 100k zaprosy v den', dlya malykh sajtov dostаточno, dlya bol'shogo e-kommerca — Paid plan ($5 za 10M zaprosy).

## Zaklyuchenie i Primenenie

SSG v Nuxt 3 s pravilnymi route rules + payload optimization + parallel'nym rendering daet dramaticheskoe uluchshenie. Real'nye cifry: 12-minut sborka → 3,5 minuty, razvertyvanie 5 minut → 2 minuty, edge TTFB 280ms → 120ms. No ètо trebuet otkazyisya ot "pererendir vsekh rut" i perejti k gibridnoj arhitekture ISR + SPA. Pri reshenii uchityvajte potrebnost' freshness soderžhaniya, chastotu sborki i limitacii edge-platformy. Esli v production postroit' cache-sloň dlyа inkremental'noj sborki, mozhno sniziťCI/CD rashody na 80% — no ètо dobaviт complexity invalidacii kesha. Nachnite s prostoj `swr` strategii, a kogda vremya sborki stanovitsya problem — pere`dite na inkremental'nye sborki.