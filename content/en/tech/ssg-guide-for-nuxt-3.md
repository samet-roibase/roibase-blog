---
title: "SSG Guide for Nuxt 3"
description: "Static site generation with Nuxt 3: prerender strategies, performance, and deployment."
publishedAt: 2026-05-04
category: tech
i18nKey: tech-nuxt-3-ssg-guide-2026-05
tags: [nuxt, ssg, performance]
readingTime: 5
author: Roibase
---

## Why SSG?

- **TTFB ≈ 0** — HTML served from the CDN
- **Cost** — no runtime server, just static files
- **Security** — minimal attack surface

## Setup in Nuxt 3

Add page paths to `nitro.prerender.routes`; with `crawlLinks: true` discovery is automatic.

```ts
nitro: {
  prerender: {
    crawlLinks: true,
    failOnError: false,
    routes: ['/', '/sitemap.xml']
  }
}
```

## Hosting options

- **Outplane** — node-server preset, with a Procfile
- **Cloudflare Pages** — `NITRO_PRESET=cloudflare-pages`
- **Vercel/Netlify** — pick the matching preset
