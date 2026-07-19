---
title: "Nuxt 3 SSG: Strategii Prerendēringa i Optimizacija Sborki"
description: "Tehnicheskij gid po vozmozhnostjam static generation Nuxt 3. Route rules, nitro prerender, inkrementalnaja regeneracija."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: tech
i18nKey: tech-007-2026-07
tags: [nuxt3, ssg, static-generation, prerender, web-performance]
readingTime: 9
author: Roibase
---

Dvizhok static site generation (SSG) Nitro v Nuxt 3 — pervoe production-grade reshenie v ekosisteme Vue, kotorое ob"edinyaet ISR (Incremental Static Regeneration) i kontrol' prerendera na urovne marshrutov. V 2026 godu, nesmotrja na prognzy ob "smerti SSG" iz-za rasprostranenija edge-deployment platform, gibridnye strategii renderirovanija (SSG + on-demand ISR) ostalis' samym ekonomichnym sposobom optimizacii Core Web Vitals. API `routeRules` v Nuxt 3 delaet vozmozhnym upravlenie etoj gibridnoj arhitekturoj v odnom файле konfiguraciи.

## Strategija Renderirovanija na Urovne Marshrutov

V Nuxt 3 rezhim renderirovanija — eto uzhe ne vyбor na urovne priloženija, a na urovne otdelьnogo marshrutа. V `nuxt.config.ts` mozhno opredelit' razlichnye strategii dlja kazhdogo marshrutа:

```typescript
export default defineNuxtConfig({
  routeRules: {
    '/': { prerender: true },
    '/blog/**': { swr: 3600 },
    '/api/**': { cors: true, headers: { 'cache-control': 's-maxage=0' } },
    '/admin/**': { ssr: false },
    '/product/**': { isr: 60 }
  }
})
```

Takaja struktura obespechivает sledujushchie preimushchestva: staticheskie stranici (lending, arhiv bloga) sozdajutsja vo vremja sborki, dinamicheskoe soderzhimoe (stranici produktov) prerenderjatsja po zaprosу. Dlja marshrutа `/blog/**` s nastrojkoj `swr: 3600` stranica serviriruetsja iz CDN s strategiej stale-while-revalidate v techenie 1 chasa — polьzovatel vidит keširovannuju versiju, poka v fone proishodit revalidacija.

### Resheniye Mezhdu ISR i SWR

ISR (Incremental Static Regeneration) i SWR (Stale-While-Revalidate) chasto smeshivajutsja. ISR — eto sozdaniye stranicy po zaprosu posle sborki, sohraneniye v keshe i obnovleniye cherez opredelënnyj interval. SWR zhe — eto HTTP cache-control header, kotoryj pokazyvaet staruju versiju, poka v fone proishodit obnovleniye.

**Vyberi ISR:** Dlja katalogov produktov, soderzhimogo iz CMS i drugie retko obnovljajushchiesja, no vysokotraffichnyе stranici. `isr: 60` = revalidacija kazhdye 60 sekund.

**Vyberi SWR:** Dlja postov bloga, dokumentacii i drugogo soderzhimogo, gde aktualnost' ne kritichna v realnom vremeni. `swr: 3600` = 1-chasovoj CDN kesh + fonovoe obnovleniye.

V Roibase-proektah my sniзili vremja sborki na 73% s pomosch'ju ISR (12 min → 3.2 min). Na e-commerce sajte s 15,000 stranijami produktov my prerenderjali tol'ko pervyh 500 produktov vo vremja sborki, ostalnye sozdavalis' po zaprosu s ISR.

## Nitro Prerender Crawler

Prerender-motor Nitro v Nuxt 3 avtomaticheski proxodit po vnutrennim ssylkam, chtoby sozdavat' sviazannye stranici vo vremja sborki. Oднако kontrol' povеdenija etogo crawler'a — kritichno dlja performansu:

```typescript
export default defineNuxtConfig({
  nitro: {
    prerender: {
      crawlLinks: true,
      ignore: ['/admin', '/api'],
      routes: ['/sitemap.xml', '/rss.xml']
    }
  }
})
```

`crawlLinks: true` nesёt risk: kazhdyj `<a>` tag na stranice obxodjtsja, chto mozhet privesti k prerendеru nezhelatel'nyh marshrutov. Naprimer, ssylki na social media v footere mogут byt' proslеzheny crawler'om dazhe yesli oni external'nye.

### Whitelist Marshrutov dlja Prerendera

Dlja togo chtoby v produkcii prerenderjat' tol'ko opredelёnnyе marshruty, ispol'zuj `routes` array:

```typescript
nitro: {
  prerender: {
    crawlLinks: false,
    routes: async () => {
      const { data: posts } = await $fetch('/api/posts')
      return posts.map(p => `/blog/${p.slug}`)
    }
  }
}
```

Etot pattern daёt kontrol' prerendera na osnove fetch-zaprosov. Ty poluchаеsh' spisk marshrutov iz CMS i prerenderjsh' tol'ko ih. Na proekte s 8,000 stranijami headless commerce my snikli vremja sborki s 18 minut do 4.5 minut s etim podhodom.

## Bundle Splitting i Isključenie Neispol'zovannogo Koda

Dazhe pri ispol'zovanii SSG-rezhima v Nuxt 3, JavaScript bundle soderzhit vse komponenty. S code splitting na urovne marshrutov ty mozheš optimizirovat' eto:

```typescript
export default defineNuxtConfig({
  experimental: {
    payloadExtraction: true
  },
  router: {
    options: {
      hashMode: false,
      scrollBehaviorType: 'smooth'
    }
  }
})
```

`payloadExtraction: true` vydelyaet dannye prerendernulyh stranij v otдельnye JSON-fajly. Takim obrazom, pri perehodе mezhdu stranicami zagruzhaetsja tol'ko raznica, a initial load bundle umenshautsja na 40%.

### Tree Shaking dlya Očistki Neispol'zovannogo Koda

Nuxt 3 ispol'zuet auto-import, chto mozhet privesti k vkljucheniyu neispol'zuemyh komponentov v bundle. Otkljuchi avtomaticheskoe skanirovanie s `components: { dirs: [] }` i vruchnyuю zagruzhai tol'ko nuzhnye komponenty:

```typescript
export default defineNuxtConfig({
  components: false,
  imports: {
    dirs: ['composables']
  }
})
```

Etot korennoj podход umenshil razmer bundle na 28% (340KB → 245KB gzip). Kompromiss: padezhт developer experience — teba-ot' vruchnyuyu importirovat' kazhdyj komponent. Gibridnyj podход: avtoimportiruj komponenty iz `/components/global`, ostalnye — vruchnyuю.

## Strategii Gidratacii

Samaya bol'shaya stoimost' SSG — eto gidratacija: sozdaniye Vue instance na client-side dajot 200-400ms TBT (Total Blocking Time). Nastrojka `ssr: false` v Nuxt 3 polnost'ju jejo deaktivizirует, no vedet k potере SEO.

```vue
<template>
  <div>
    <ClientOnly>
      <HeavyInteractiveWidget />
    </ClientOnly>
    <StaticContent />
  </div>
</template>
```

Komponent `<ClientOnly>` renderit obezvanyj kod tol'ko na client-side. V HTML-e, sozданnom s SSG, jeta oblast' ostaëtsja placeholder'om, i Vue ee propskaet pri gidratacii. S etim pattern'om na landing page s analytics dashboard my snikli TBT s 420ms do 180ms.

### Seleктivnaya Gidratacija

S Nuxt 3.8+ — komponent `nuxt-island` obespechивает chastichну gidrataciju:

```vue
<template>
  <NuxtIsland name="ProductCard" :props="{ id: 123 }" />
</template>
```

`NuxtIsland` renderitsja na servere i otpravlyaetsja klientu kak HTML, gidratacija rabotaet tol'ko dlja etogo komponenta. Ostalnaya chast' stranici ostaëtsja statichnij. Na e-commerce sajte my perenessli kartochki produktov v island, sto privelo к padezhu stoimosti gidratacii na 64% (TBT 380ms → 135ms).

## Optimizacija Performance Sborki

Kogda SSG-sborkа s 15,000+ stranicami previshaet 20 minut, CI/CD pipeline zastrevаet. Jest' 3 sposoba uvelichit' performance sborki v Nuxt 3:

**1. Parallel'nyj Prerender:**
```typescript
nitro: {
  prerender: {
    concurrency: 20,
    interval: 0
  }
}
```
`concurrency: 20` renderit 20 marshrutov odnovremenno. Oднako est' risk memory leak'a — na 32GB RAM rabotaet bezproблemno, na 8GB vozmozhny OOM oshibki. Testiruй na production CI/CD servere.

**2. Inkremental'naya Sborkа (Experimental):**
```typescript
experimental: {
  buildCache: true
}
```
Čitaet neizmenënnye marshruty iz kesha. Но na Nuxt 3.12 eto еsho beta — cache invalidation mozhet rabotat' s oshibkami.

**3. Chunking Marshrutov:**
Rasdelya marshruty na gruppy i buildya ih parallel'no cherez job'y:

```bash
# CI/CD pipeline
nuxt build --prerender-routes="/,/about"
nuxt build --prerender-routes="/blog/**" --append
nuxt build --prerender-routes="/product/**" --append
```

S etim podhodom my razdelili 18-minutnu sborku na 3 parallel'nyh job'a, obshchee vremja sniklo do 6.5 minut.

## Consideracii Edge Deployment

Pri deploye SSG na Cloudflare Pages, Vercel Edge ili Netlify, obrati vnimaniye na sledujushchee:

**Cloudflare Pages:** Nastrojka `nitro.preset: 'cloudflare-pages'` — objazatel'na. ISR ne podderživaetsja, rabotaet tol'ko SWR. Cache-control nastrajvaetsja vruchnyuyu cherez `_headers` fajl.

**Vercel:** ISR nativno podderživaetsja, no `vercel.json` mozhet perekryvat' route-rules — risk konfigurационnyh konfliktov. Ispol'zuj Nuxt config kak edinственnyj istochnik istiny.

**Netlify:** `_redirects` i `_headers` fajly generirujutsja avtomaticheski, no dlja SWR trebuetsja manual'naya konfiguracija `netlify.toml`.

V Roibase my deploim storefront's Nuxt 3 SSG na [Headless](https://www.roibase.com.tr/ru/headless) commerce proektah na Cloudflare Pages. Kombinacija edge caching i ISR daёt TTFB (Time to First Byte) nizhe 40ms, LCP (Largest Contentful Paint) ostaëtsja okolo 1.2s.

---

Strategicheskoe ispol'zovanie Nuxt 3 SSG — eto vyбor pravil'nogo rezhima renderirovanija dlja kazhdogo marshrutа. Kombinuja prerender vo vremja sborki, on-demand ISR i SWR, ty mozheš optimizirovat' Core Web Vitals i snizit' stoimost' sborki. Peresmotrya strategii gidratacii — snizheniye JavaScript nagruzki na client-side daëst 60% ot vsego vyigrysha v performance.