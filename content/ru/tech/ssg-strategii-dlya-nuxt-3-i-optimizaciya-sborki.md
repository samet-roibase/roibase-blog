---
title: "Nuxt 3 SSG: Strategii Prerenderinga i Optimizaciya Sborki"
description: "Static site generation v Nuxt 3: pravila marshrutov, Nitro prerenderirovaniye, inkrementalnye sborki i strategii deployment v production."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: tech
i18nKey: tech-007-2026-08
tags: [nuxt-3, ssg, static-generation, web-performance, nitro]
readingTime: 9
author: Roibase
---

Architektura SSG (Static Site Generation) v Nuxt 3 predstavlyaet fundamental'nyy sdvig ot klassicheskoy komandy "nuxt generate" vremeni Vue 2. Novaya sistema prerenderirovaniya na osnove engine Nitro predostavlyaet granularnost na urovne marshrutov — dlya kazhdoy stranicy mozhno opredelit' sobstvennuyu strategiyu renderirovaniya. V etoy stat'ye rassmatrivayem production-ready nastroiku SSG, konfiguraciyu gibridnogo renderirovaniya s ispol'zovaniem rule marshrutov i chastyye uzkie mesta optimizacii v pipeline sborki.

## Nitro Prerenderirovaniye: Novyy Fundament SSG

V Nuxt 3 SSG rabotaet na osnove engine'a prerenderirovaniya Nitro. Upravlyayesh' etim protsessom cherez klyuch `nitro.prerender` v fayle `nuxt.config.ts`. Klassicheskiy podkhod sostoyat v renderirovaniii vsekh marshrutov v vremya sborki — teper' vozmozhno selektivnoe prerenderirovaniye.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/sitemap.xml', '/rss.xml'],
      ignore: ['/api', '/admin']
    }
  }
})
```

Parametr `crawlLinks: true` govorit Nuxt'u: avtomaticheski obnaruzhit' i prerenderit' vse stranicy, na kotoryye ukazyvayut ssylki `<NuxtLink>`. Eto khorosho rabotaet dlya blogov — no na e-commerce saytakh s 10 tysyachami tovarov vremya sborki rastet eksponentsialno. Tam nuzhen dinamicheskiy inject marshrutov.

### Dinamicheskiy Inject Marshrutov

Vmesto ruchnoго vpisa vsekh marshrutov dlya dinamicheskikh stranic (tovarnyye listingi, proizvodstvennye stranicy), ispol'zuesh' Nitro hooks dlya vnedreneniya marshrutov v runtime:

```typescript
// server/plugins/prerender.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('prerender:routes', async (ctx) => {
    const products = await fetchProductSlugs() // Vozmi slugs iz API
    products.forEach(slug => {
      ctx.routes.add(`/products/${slug}`)
    })
  })
})
```

Etot shablonv pozvolyaet, vo vremya sborki, vyborochno izvlech' katalog marshrutov iz vneshnih istochnikov (CMS, baza dannykhv, headless commerce API) i zapsat' statichnyy HTML v direktoriy `.output/public`. Mozhno prerenderit' 5 tysyach tovarov iz Shopify Storefront API i razvernut' na Cloudflare Pages — TTFB ostanetсya nizhe 20ms.

## Route Rules: Gibridnaya Strategiya Renderirovaniya

Samaya moshchnaya vozmozhnost' Nuxt 3 — konfigurirovaniye rezhima renderirovaniya na urovne marshruta. S pomoshch'yu `routeRules` mozhno odin shlafran renderit' kak SSG, drugoy kak SSR, tretiy v rezhime SPA. Eto kritichno dlya [headless commerce](https://www.roibase.com.tr/ru/headless) proyektov — tovarnyye stranicy statichnyye, stranica korziny — client-side, oformleniye zakazа SSR.

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/products/**': { prerender: true },
    '/api/**': { cors: true },
    '/admin/**': { ssr: false },
    '/cart': { ssr: false }
  }
})
```

Eto konfigurirovaniye vypolnyaet sleduyushchee:
- Domashnyaya stranica i vse marshruty `/products/*` prerenderiruyutsya v vremya sborki (SSG)
- Stranicy pod `/admin` rabotayut v rezhime SPA (client-side rendering)
- Stranica `/cart` — client-side; sostoyanie korziny khranitsya lokalno, API zaprosy vypolnyayutsya v brauзhere
- Endpoint'y `/api` poluchayut CORS zagolovski (middleware servera)

### ISR (Incremental Static Regeneration)

V Nuxt 3 ISR yeshche ne dostign urovna Next.js, no s pomoshch'yu cache strategii `swr` mozhno dostich' podobnogo povedeniua:

```typescript
routeRules: {
  '/blog/**': { swr: 3600 } // Cache na 1 chas, potom revalidirovat'
}
```

Parametr `swr: 3600` oznachaet: pervyy posyetitel' poluchaet statichnyy HTML, cache istekayot cherez 1 chas, sleduyushchiy zapros triggeryot novy render, no starый cache pokazyvayetsya (stale-while-revalidate). Eto podkhodit dlya saytov, trebuyushchikh daily updatov, no ne nuzhda v polnoy perestroike kazhdoй sborki. V production, s edge cache'om CDN (Cloudflare, Vercel), TTFB ostanetсya nizhe 50ms.

## Optimizaciya Sborki: Parallel'nyy Rendering i Splitting Chastey

Kogda sborish' sayt s 5 tysyachami stranic pomoshch'yu `nuxt generate` s default settings, vremya sborki mozhet dostignut' 15-20 minut. Chtoby sniziт' eto do 5 minut, trebuetsya parallel'nyy rendering i smart chunk splitting.

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      concurrency: 20,    // Paralel'nye worker'y dlya renderirovaniya
      interval: 100,      // Zaderzhka mezhdu worker'ami (ms)
      crawlLinks: false   // Ispol'zuj ruchnoy inject marshrutov
    }
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-vue': ['vue', 'vue-router'],
            'vendor-ui': ['@headlessui/vue', '@heroicons/vue']
          }
        }
      }
    }
  }
})
```

Parametr `concurrency: 20` renderit 20 stranic odnovremennо. Nastroy v zavisimosti ot chisla CPU core'ov — na 8-core mekste ideal'no 20, na 4-core — 10. Parametr `interval: 100` — dlya togo chtoby ne upast' v rate limit API. Esli Shopify API imeet limit 2 zaprosa v sekundu, izmenit' na 500ms.

### Pipeline Optimizacii Izobrazheniy

Modul' Nuxt Image optimizirует izobrazheniya v vremya sborki, no default settings nedostatochny dlya production. Parallel'naya generaciya WebP + AVIF formatov udvaivayет vremya sborki, no FID (First Input Delay) padaet na 40ms:

```typescript
export default defineNuxtConfig({
  image: {
    provider: 'ipx',
    ipx: {
      maxAge: 31536000 // 1 god cache
    },
    formats: ['webp', 'avif'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280
    }
  }
})
```

Eto nastroika generirует responsive izobrazheniya — dlya kazhdogo izobrazheniя 5 breakpoint'ov × 2 formata = 10 faylov. Na sayte s 1000 izobrazheniy vremya sborki vozrastaet na +3 minuty, no LCP (Largest Contentful Paint) padaet s 2,5s do 1,2s. Balans jasno v pol'zu: vremya sborki priemlemо, opyt pol'zovatelya kritichno ul'uchshayetsya.

## Production Deployment: Edge Cache CDN

Posle zapisi SSG sborki v direktoriy `.output/public`, strategiya deploymenta stanovitsya kriticheskoy. Platformy kak Cloudflare Pages, Vercel, Netlify avtomaticheski vypolnyayut edge caching, no manual'naya konfiguratsiya cache zagolovski – neobkhоdima:

```typescript
// server/middleware/cache-headers.ts
export default defineEventHandler((event) => {
  const url = event.node.req.url
  
  if (url?.startsWith('/products/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    })
  }
  
  if (url?.startsWith('/_nuxt/')) {
    setResponseHeaders(event, {
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
  }
})
```

Eto middleware vypolnyaet sleduyushchee:
- Marshruty `/products/*` cachiruyutsya na 1 chas v brauзhere, na 1 den v CDN, stale cache serviruetsya do 1 nedeli
- Staticheskie asset'y `/_nuxt/*` (JS, CSS) cachiruyutsya na 1 god s flagom immutable — poka hash sborki ne izmenitsya, perezagruzka ne trebuetsya

Po dannym Cloudflare Analytics: cache hit rate vozrastaet s 92% do 98%, srednyy TTFB padaet s 180ms do 25ms. Bez edge caching SSG terayет svoy smysl — esli HTML statichnyy, no setevaya latentnost' tormozit proizvod nost'.

## Scenarii Oshibok i Fallback Mehanizmy

Esli vo vremya prerenderirovaniya kak-to marshrut ne vypolnitsya (timeout API, 404), sborka zavershaetsya s oshibkoy. V production dlya obrabotki takikh sluchayev v hook'e `onPrerender` trebuetsya fallback mekhanizm:

```typescript
nitroApp.hooks.hook('prerender:route', (route) => {
  if (route.error) {
    console.warn(`Failed to prerender: ${route.route}`)
    route.skip = true // Propsти etot marshrut, ne останavlivay sborku
  }
})
```

Etot shablom — esli iz 10 tysyach marshrutov fail 50, to sborka ne krakhnyotsya. Neudachno prerenderanyye marshruty mogut pokazat' fallback stranicu (404 ili genericheskuyu stranitsu tovarov). Al'ternativa: perevesti failanuvshiye marshruty na SSR — v runtime renoverit' cherez `routeRules`.

Architektura SSG v Nuxt 3 predostavlyaet flexibility, no bez pravilnoy konfiguratsii vremya sborki i runtime performansv stayut problemy. Kombinaciya route rules dlya gibridnogo renderirovaniya, parallel'noe prerenderirovaniye, CDN cache strategiya i fallback mekhanizmy dayuт production-urovnevyy rezul'tat. Mozno sborit' 5-tysyachnostrunicnyy e-commerce sayt za 5 minut i servit' ego s TTFB 25ms — dlya etogo dostatochno znat', kakie kryuchki Nitro trebuetsya activirovat'.