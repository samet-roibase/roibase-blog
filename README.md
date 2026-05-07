# Roibase Blog

7-dilli, otonom yayın yapan teknoloji blog'u. Nuxt 3 + Nuxt Content v2 üstüne kurulu, Outplane'de çalışıyor.

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
Her kategorinin kendi rengi var (`CATEGORY_COLORS`) — anasayfa grid + makale tag + kategori başlık tutarlı.

## İçerik

Markdown dosyaları `content/{lang}/{category}/{slug}.md` altında. Her dosya frontmatter şemasını (`content.config.ts`) takip etmeli — `i18nKey` cross-language mapping için zorunlu.

## Otomasyon

n8n workflow (`workflow/main.json`) her 8 saatte bir çalışır:
- GitHub'dan rotation/topic-pool/promptları çeker
- Round-robin kategori seçer + topic seçer
- Claude Sonnet 4.5 ile TR makale üretir (1500 kelime)
- Claude Haiku 4.5 ile 6 dile çevirir
- 9 dosya tek atomic commit ile push (Git Data API): 7 makale + rotation update + topic-pool update

Detay: [docs/AUTOMATION.md](docs/AUTOMATION.md)

## SEO altyapısı

- `/sitemap.xml` — i18nKey-grouped hreflang alternates ile
- `/robots.txt` — production-ready, LLM-Content directives
- 16 LLMs.txt endpoint — AI crawler dokümantasyonu (`/llms.txt`, `/llms-{lang}.txt`, `/llms-full-{lang}.txt`)

## Build & Deploy

```bash
# Outplane (default)
npm run build
npm start

# Cloudflare Pages
NITRO_PRESET=cloudflare-pages npm run build
```

## Tracking

Google Tag Manager ana site ile aynı container (GTM-KVX54H4M), Cloudflare Tag Gateway üzerinden first-party (`/metrics`).
