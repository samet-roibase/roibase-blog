# Roibase Blog

7-dilli, otonom yayın yapan teknoloji blog'u. Nuxt 3 + Nuxt Content v2 üstüne kurulu, Outplane'de çalışacak şekilde paketlendi.

> **Mevcut durum:** İskelet hazır, içerik üretim otomasyonu (n8n + Claude API) ileri fazda. Site şu an `NUXT_PUBLIC_NOINDEX=true` ile arama motorlarına KAPALI yayında.

## Hızlı başlangıç

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Diller

`config/locales.ts` — TR (default), EN, DE, ES, FR, IT, RU.

## Kategoriler

`config/categories.ts` — AI, Marketing, Tech, Data, Gaming, Travel, Lifestyle.

## İçerik

Markdown dosyaları `content/{lang}/{category}/{slug}.md` altında. Her dosya frontmatter şemasını (`content.config.ts`) takip etmeli.

## Build & Deploy

```bash
# Outplane (default)
npm run build
npm start

# Cloudflare Pages
NITRO_PRESET=cloudflare-pages npm run build
```

## Indeks kontrolü

| Env | Davranış |
|---|---|
| `NUXT_PUBLIC_NOINDEX=true` (default) | `<meta robots noindex>` + `robots.txt: Disallow: /` |
| `NUXT_PUBLIC_NOINDEX=false` | Normal SEO açık (sitemap, allow) |

Production'a geçerken `false` yapın.
