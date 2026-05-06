---
title: "Nuxt 3 için SSG Rehberi"
description: "Nuxt 3 ile statik site üretimi (SSG): prerender stratejileri, performans ve dağıtım."
publishedAt: 2026-05-04
category: tech
i18nKey: tech-nuxt-3-ssg-guide-2026-05
tags: [nuxt, ssg, performance]
readingTime: 5
author: Roibase
---

## Neden SSG?

- **TTFB ≈ 0** — CDN'den HTML servis
- **Maliyet** — runtime sunucu yok, sadece statik dosya
- **Güvenlik** — saldırı yüzeyi minimum

## Nuxt 3'te kurulum

`nitro.prerender.routes` listesine sayfa yollarını ekleyin; `crawlLinks: true` ile otomatik keşif aktif olur.

```ts
nitro: {
  prerender: {
    crawlLinks: true,
    failOnError: false,
    routes: ['/', '/sitemap.xml']
  }
}
```

## Hosting seçenekleri

- **Outplane** — node-server preset, Procfile ile
- **Cloudflare Pages** — `NITRO_PRESET=cloudflare-pages`
- **Vercel/Netlify** — uygun preset ile
