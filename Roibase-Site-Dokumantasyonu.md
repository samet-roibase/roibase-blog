# Roibase — Site Dokümantasyonu

> **Roibase** · "Herkesin birlikte çalışmayı hayal ettiği butik dijital pazarlama ajansı."
> Premium dijital performans + yazılım ajansı · İstanbul · 2026
> https://www.roibase.com.tr

---

## İçindekiler

1. [Şirket özeti](#1-şirket-özeti)
2. [Hizmet portföyü (15 disiplin)](#2-hizmet-portföyü-15-disiplin)
3. [Site mimarisi & sayfa haritası](#3-site-mimarisi--sayfa-haritası)
4. [SEO altyapısı — sitemap, robots, hreflang, JSON-LD](#4-seo-altyapısı--sitemap-robots-hreflang-json-ld)
5. [LLMs.txt protokolü — AI crawler dokümantasyonu](#5-llmstxt-protokolü--ai-crawler-dokümantasyonu)
6. [Dijital sözlük — 1001 terim, 7 dil](#6-dijital-sözlük--1001-terim-7-dil)
7. [Teknoloji yığını](#7-teknoloji-yığını)
8. [Tasarım sistemi](#8-tasarım-sistemi)
9. [Performans & PageSpeed yatırımları](#9-performans--pagespeed-yatırımları)
10. [Analytics & Tag stack](#10-analytics--tag-stack)
11. [Form / İletişim altyapısı](#11-form--i̇letişim-altyapısı)
12. [Deployment & CI](#12-deployment--ci)
13. [Önemli URL'ler — hızlı referans](#13-önemli-urller--hızlı-referans)

---

## 1. Şirket özeti

**Roibase**, 15+ yıllık BT, veri ve dijital pazarlama kariyerinin süzülmüş hali olan bir **butik büyüme mühendisliği ajansı**. 2026'da İstanbul'da kuruldu. Kurucusu **Samet YILDIZ**'ın 8+ yıllık liderlik + 12+ yıllık dijital pazarlama + IT/SAP entegrasyon zemini üstüne kurulu.

**Ne yapıyoruz:** Performans pazarlamasını mühendislik disiplinine bağlıyoruz. Reklam kampanyaları, SEO/GEO, CRO, marka kimliği, headless e-ticaret, first-party data altyapısı, retention engineering, premium yayıncı stratejisi — hepsi tek çatı altında.

**Ne yapmıyoruz:** "Sadece kampanya basan" klasik ajans hizmeti, kurumsal yavaşlık, "ölçemediğimiz" pazarlama. Tahmin yerine test, iletişim yerine entegrasyon, vaat yerine attribution.

**İletişim**
- Website: https://www.roibase.com.tr
- Email: hello@roibase.com.tr
- Telefon: +90 542 575 74 57
- LinkedIn: https://www.linkedin.com/company/roibase/
- Instagram: https://www.instagram.com/roibaseagency/

**Konum:** İstanbul, Türkiye · Hibrit-uzaktan çalışma kültürü.

---

## 2. Hizmet portföyü (15 disiplin)

Hizmetler 4 ana sütun altında gruplanır: **Acquisition** (kazanım), **Experience** (deneyim), **Intelligence** (zeka), **Partnership** (ortaklık).

### Acquisition

| # | Servis | Slug | Tek-cümle |
|---|--------|------|-----------|
| 1 | **Dijital Pazarlama** | `dijitalpazarlama` | Performans reklamcılığı, signal altyapısı, kreatif operasyonu, attribution modelleme + forecast'i tek çatı altında birleştiren uçtan uca strateji. |
| 2 | **Performans Pazarlaması (PPC)** | `ppc` | Google Ads, Meta, TikTok, LinkedIn için server-side dönüşüm mimarisi, otomatik bid katmanları + full-funnel attribution. |
| 3 | **Teknik SEO** | `seo` | Crawl bütçesinden Core Web Vitals'a, schema mimarisinden hreflang cluster'larına — sıralamayı tahmine değil, mühendislik disiplinine bağlayan operasyon. |
| 4 | **GEO — Generative Engine Optimization** | `geo` | ChatGPT, Perplexity, Gemini, Claude, Google AI Overviews'da markanı "cevabın içine" yerleştirme; alıntılanabilir içerik mimarisi + LLM citation ölçümü. |
| 5 | **ASO — App Store Optimization** | `aso` | iOS + Android için keyword intelligence, creative A/B (PPO + Play Experiments), Apple Search Ads, custom product pages, lokalizasyon pipeline. |
| 6 | **Premium Yayıncı Programı** | `premiumyayinci` | Premium yayıncılar için header bidding, direkt satış, subscription, first-party monetization — ad tech stack'i gelir makinesine dönüştürme. |

### Experience

| # | Servis | Slug | Tek-cümle |
|---|--------|------|-----------|
| 7 | **CRO — Dönüşüm Oranı Optimizasyonu** | `cro` | Research-driven hipotez, Bayesian + sequential A/B test, segment-level analiz; tahmin değil, test disiplini. |
| 8 | **UI / UX — Dönüşüm Odaklı Tasarım** | `ui-ux` | Araştırma, information architecture, design system, prototipleme, usability testing, accessibility, dev handoff — tek disiplinde. |
| 9 | **Markalaşma & Brand Identity** | `branding` | Positioning, isim mimarisi, görsel sistem, sözel kimlik, digital touchpoint, rollout — tek disiplinli marka mühendisliği. |
| 10 | **Headless Commerce** | `headless` | Hydrogen + Remix + Next.js + composable MACH mimarisi; maksimum performans, esneklik, ownership. |
| 11 | **Shopify Partner Hizmetleri** | `shopify` | Shopify Plus tema mimarisi, Checkout Extensibility, Functions, Markets, B2B, app entegrasyonu, Hydrogen, migration. |

### Intelligence

| # | Servis | Slug | Tek-cümle |
|---|--------|------|-----------|
| 12 | **First-Party Veri & Ölçüm Mimarisi** | `firstparty` | sGTM, Conversion API, BigQuery/Snowflake data lake, Consent Mode v2 + TCF 2.2, identity resolution, reverse ETL — 3rd-party-cookie sonrası ölçüm. |
| 13 | **Veri Analizi & İçgörü Mühendisliği** | `verianalizi` | KPI tree, dbt modelleme, Bayesian MMM, incrementality testi, semantic layer — pazarlama datasını dashboard'a değil, karar mekanizmasına bağlama. |
| 14 | **CDP & Retention Engineering** | `retention-engineering-cdp` | Identity graph, RFM + LTV + churn skorlama, 12-18 lifecycle akışı, kanal orkestrasyonu, kontrol-gruplu experimentation. |

### Partnership

| # | Servis | Slug | Tek-cümle |
|---|--------|------|-----------|
| 15 | **Teknoloji Stack & İş Ortaklığı** | `techstack-partnership` | Google Premier, Meta Business, Shopify Plus, Klaviyo Master Elite, Algolia, Coveo, Braze, Segment, Contentful, Amplitude, commercetools — strateji + entegrasyon. |

Her hizmet sayfası 7 dilde aynı derinlikte çevrildi (TR, EN, DE, ES, FR, IT, RU).

---

## 3. Site mimarisi & sayfa haritası

Nuxt 3 + dinamik `[lang]` segmenti. Tüm rotalar `/{lang}/{slug}` formunda — trailing-slash YOK, canonical SLASH'SIZ.

**Desteklenen diller:** `tr` (default) · `en` · `de` · `es` · `fr` · `it` · `ru` (7 dil)

### Top-level sayfalar (her dilde)

```
/{lang}/                          → Anasayfa (HomeJourney scrollytelling)
/{lang}/hakkimizda                → Hakkımızda + ekip + zaman çizgisi
/{lang}/iletisim                  → İletişim formu + harita
/{lang}/glossary                  → Dijital Sözlük (1001 terim)
/{lang}/privacy                   → Gizlilik politikası
/{lang}/terms                     → Kullanım koşulları
/{lang}/cookies                   → Çerez politikası

# 15 hizmet sayfası
/{lang}/dijitalpazarlama          /{lang}/ppc                /{lang}/seo
/{lang}/geo                       /{lang}/aso                /{lang}/cro
/{lang}/ui-ux                     /{lang}/branding           /{lang}/headless
/{lang}/shopify                   /{lang}/firstparty         /{lang}/verianalizi
/{lang}/retention-engineering-cdp /{lang}/premiumyayinci     /{lang}/techstack-partnership

# Yan içerik
/{lang}/youtube  /{lang}/tv  /{lang}/sunum
```

**Toplam üretilen sayfa:** 21 sayfa × 7 dil = **147 prerendered URL** + sitemap + robots + 22 LLMs.txt = **~170 statik dosya**.

`config/pages.ts` tek **source of truth** — buraya bir slug eklendiğinde sitemap, prerender ve `[page].vue` validator otomatik senkronlanır.

---

## 4. SEO altyapısı — sitemap, robots, hreflang, JSON-LD

### Sitemap

**URL:** [`https://www.roibase.com.tr/sitemap.xml`](https://www.roibase.com.tr/sitemap.xml)

- Build sırasında `server/routes/sitemap.xml.ts` tarafından üretilir.
- Her sayfanın **7 dilin tamamı için** `<xhtml:link rel="alternate" hreflang="...">` alternates listesi yer alır.
- Anasayfaya priority **1.0**, hizmet sayfalarına **0.8**, legal sayfalara **0.3**.
- `<lastmod>` build tarihi, `<changefreq>` weekly.

### Robots

**URL:** [`https://www.roibase.com.tr/robots.txt`](https://www.roibase.com.tr/robots.txt)

```
User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://www.roibase.com.tr/sitemap.xml

# AI crawler hub — well-known LLM-Content path
LLM-Content: https://www.roibase.com.tr/llms.txt
LLM-Content: https://www.roibase.com.tr/llms-tr.txt
… (her dil için ayrı satır)
LLM-Content: https://www.roibase.com.tr/llms-full.txt
LLM-Content: https://www.roibase.com.tr/llms-full-tr.txt
…
LLM-Content: https://www.roibase.com.tr/llms-glossary-tr.txt
…
```

### Canonical & redirects

- **Canonical host: `www.roibase.com.tr`** (apex `roibase.com.tr` 301 ile www'ya yönlendiriliyor).
- Trailing-slash strategy: kanonik sürüm SLASH'SIZ. `/tr/ppc/` → `/tr/ppc` (301).
- Server middleware (`server/middleware/canonical-and-redirects.ts`) eski URL'leri 301 ile yönetiyor.

### Per-page meta

Her sayfa `useSeoMeta()` ile tanımlı:
- **`<title>`** — i18n master.json `seoTitle` veya `pages.{slug}.title`.
- **`<meta name="description">`** — `seoDescription` veya `lead`.
- **`<link rel="canonical">`** — `https://www.roibase.com.tr/{lang}/{slug}`.
- **`<link rel="alternate" hreflang="...">`** — 7 dilin tamamı + `x-default` (TR).
- **OpenGraph + Twitter Card** — title, description, og:image (logo).

### JSON-LD structured data

| Şema türü | Yer aldığı sayfa |
|-----------|-------|
| `Organization` | Tüm sayfalarda (head'de, founder + sameAs[] + contactPoint) |
| `WebSite` (with SearchAction) | Anasayfa |
| `BreadcrumbList` | Anasayfa hariç tüm sayfalar (SiteBreadcrumb component) |
| `AboutPage` | hakkimizda |
| `ContactPage` | iletisim |
| `Service` | 15 hizmet sayfasının her biri |
| `FAQPage` | Hizmet sayfalarındaki SSS bloğu |
| `DefinedTermSet` (1001 üye) | glossary |

Tüm BreadcrumbList şemaları `#breadcrumb` anchor ID kullanır, AboutPage/ContactPage `breadcrumb: { @id: "...#breadcrumb" }` ile referans verir.

---

## 5. LLMs.txt protokolü — AI crawler dokümantasyonu

Roibase, AI çağına özel olarak **22 farklı LLMs.txt dosyası** sunuyor. Bu, ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews gibi üretken arama motorlarının siteyi anlaması, hatırlaması ve atıfta bulunması için temel altyapı.

### 1. Navigasyonel hub (kısa, link-yoğun)

| URL | İçerik |
|-----|--------|
| [`/llms.txt`](https://www.roibase.com.tr/llms.txt) | Multi-lang root hub — 7 dile yönlendirir |
| [`/llms-tr.txt`](https://www.roibase.com.tr/llms-tr.txt) | TR navigasyonel — sayfa listesi + kısa açıklama |
| [`/llms-en.txt`](https://www.roibase.com.tr/llms-en.txt) | EN navigasyonel |
| [`/llms-de.txt`](https://www.roibase.com.tr/llms-de.txt) | DE navigasyonel |
| [`/llms-es.txt`](https://www.roibase.com.tr/llms-es.txt) | ES navigasyonel |
| [`/llms-fr.txt`](https://www.roibase.com.tr/llms-fr.txt) | FR navigasyonel |
| [`/llms-it.txt`](https://www.roibase.com.tr/llms-it.txt) | IT navigasyonel |
| [`/llms-ru.txt`](https://www.roibase.com.tr/llms-ru.txt) | RU navigasyonel |

### 2. Encyclopedic full corpus (uzun, content-yoğun)

15 hizmet sayfası × tüm bloklar Markdown'a serialize edilmiş, derin içerik dosyaları:

| URL | İçerik |
|-----|--------|
| [`/llms-full.txt`](https://www.roibase.com.tr/llms-full.txt) | Multi-lang root |
| [`/llms-full-tr.txt`](https://www.roibase.com.tr/llms-full-tr.txt) | TR full encyclopedic |
| [`/llms-full-en.txt`](https://www.roibase.com.tr/llms-full-en.txt) | EN full encyclopedic |
| [`/llms-full-de.txt`](https://www.roibase.com.tr/llms-full-de.txt) | DE full |
| [`/llms-full-es.txt`](https://www.roibase.com.tr/llms-full-es.txt) | ES full |
| [`/llms-full-fr.txt`](https://www.roibase.com.tr/llms-full-fr.txt) | FR full |
| [`/llms-full-it.txt`](https://www.roibase.com.tr/llms-full-it.txt) | IT full |
| [`/llms-full-ru.txt`](https://www.roibase.com.tr/llms-full-ru.txt) | RU full |

### 3. Glossary inventory (sözlük dökümü, alfabetik)

1001 terim × 7 dil = 7.007 tanımın per-locale tek dosyada Markdown formu:

| URL | İçerik |
|-----|--------|
| [`/llms-glossary-tr.txt`](https://www.roibase.com.tr/llms-glossary-tr.txt) | TR alfabetik tüm tanımlar |
| [`/llms-glossary-en.txt`](https://www.roibase.com.tr/llms-glossary-en.txt) | EN alfabetik |
| [`/llms-glossary-de.txt`](https://www.roibase.com.tr/llms-glossary-de.txt) | DE alfabetik |
| [`/llms-glossary-es.txt`](https://www.roibase.com.tr/llms-glossary-es.txt) | ES alfabetik |
| [`/llms-glossary-fr.txt`](https://www.roibase.com.tr/llms-glossary-fr.txt) | FR alfabetik |
| [`/llms-glossary-it.txt`](https://www.roibase.com.tr/llms-glossary-it.txt) | IT alfabetik |
| [`/llms-glossary-ru.txt`](https://www.roibase.com.tr/llms-glossary-ru.txt) | RU alfabetik |

Tüm dosyalar `robots.txt`'te `LLM-Content:` direktifiyle açıkça duyuruluyor — well-known-path discovery.

---

## 6. Dijital sözlük — 1001 terim, 7 dil

**URL:** [`/{lang}/glossary`](https://www.roibase.com.tr/tr/glossary)

**Tek index sayfada** 1001 terimin tamamı render edilir (per-term detay sayfası YOK — build süresini 1 saatten 10 dakikaya indirdi). Her terim için:
- 7 dilde isim + tanım (~280-330 karakter, çevirisiz)
- İlgili Roibase hizmeti(leri) etiketi
- Anchor link (`#term-{slug}`)
- Tüm 1001 terim **`DefinedTermSet`** JSON-LD şemasında inline → search engine + LLM tek istekle hepsini görür

**Kategori dağılımı:**
- AI/ML/LLM deep (50+ terim)
- Data Engineering / Analytics (75+)
- DevOps / Cloud / Platform (60+)
- Security / Privacy / Compliance (45+)
- Mobile / iOS / Android (35+)
- Web / Performance / Modern Web (40+)
- Marketing Auto / Email (25)
- E-commerce / Retail Tech (25)
- Video / OTT / Streaming (25)
- DTC / Creator economy (25)
- Mobile App Growth (25)
- Conversational AI / LLM Eval (25)
- Game Dev / Live Ops (25)
- Cyber Security Operations (25)
- FinTech / Payments (25)
- Sustainability / GreenTech (25)
- HR Tech / Future of Work (25)
- BI & Reporting (25)
- Modern Hardware / Edge AI / IoT (25)
- Vertical mini-niches (25)
- ... ve daha fazlası

**Özel kayıt: `00 Roibase`** alfabetik sıralamada listenin en üstünde — markanın 7 dilde "Herkesin birlikte çalışmayı hayal ettiği butik dijital pazarlama ajansı" mottosuyla.

---

## 7. Teknoloji yığını

### Frontend

- **Nuxt 3.13.x** (Vue 3.5.x) — SSR + SSG hibrit, Vite tabanlı build
- **TypeScript** strict mode
- **Tailwind CSS 3.4.x** (`@nuxtjs/tailwindcss`)
- **Vue Router 4.4** — `[lang]` dinamik segment
- **VueUse** (`@vueuse/nuxt`) — composables
- **Lenis 1.3.x** — smooth scroll (anasayfa scrollytelling)
- **Fuse.js** — sözlük client-side fuzzy search

### Build & assets

- **Vite 7** (Nuxt 3.13 ile gelir)
- **`@nuxt/fonts`** — Inter + JetBrains Mono self-host (`/_fonts/` altında)
- **`@nuxt/image` + Sharp** — AVIF quality 80, lazy loading + responsive
- **esbuild** drop: `console`, `debugger` production build'de
- **Brotli** compression — Cloudflare edge'de

### Server / Runtime

- **Nitro** (Nuxt 3'ün server engine'i)
- **Node 24.x** (engines pinned)
- **`server.mjs`** entry shim — Outplane node-start buildpack için
- **NITRO_PRESET** seçenekleri:
  - `node-server` (default — Outplane, Render, Fly.io, raw VPS)
  - `cloudflare-pages` (`build:cf` script)

### Backend / Mail

- **Nodemailer** (SMTP) + **Resend** (REST API) — `MAIL_DRIVER` env ile seçilir
- **Server middleware** — canonical, www enforcement, trailing slash strip, legacy 301'ler

### i18n

- 7 dilde **single master JSON** (`i18n/master.json`) → `python3 scripts/split_i18n.py` ile per-locale dosyalara split
- Custom **`useT()`** composable (i18n module yerine — bundle hafifliği için)

### Sözlük pipeline

- `scripts/glossary_batch_*.py` (41 batch dosyası, 1001 terim) → `scripts/enrich_glossary.py` (idempotent merge) → `scripts/build_glossary.py` (master.json → `data/glossary.json`)

---

## 8. Tasarım sistemi

### Renk paleti (Tailwind extends)

```ts
primary:  '#4b6584'   // mute slate — body anchor
pCyan:    '#22d3ee'   // signature accent — CTA, glossary badge
pPurple:  '#a855f7'   // secondary accent
pGreen:   '#26de81'   // success states
pOrange:  '#fd9644'   // warning / highlight
pRed:     '#fc5c65'   // error / urgent
dark:     '#0b1120'   // dark hero, navigation
surface:  '#1e293b'   // card, modal background
```

**Felsefe:** Dark-leaning hero + light content. Hero ve scrollytelling dark-first; içerik bloklarında neutral-50/white. Mobile menu dark-only (kontrast + premium hissi).

### Tipografi

- **Inter** (display + body) — 400, 500, 600, 700, 900 weight
- **JetBrains Mono** (kicker / eyebrow / numerics) — 400, 700
- Self-hosted (`@nuxt/fonts`) — `font-display: optional` (FOUT yok, CLS ≈ 0)
- 700 ve 900 weight'leri preload (hero scrollytelling)

### Component sistemi

- **`SiteHeader.vue`** — fixed, scroll-aware, mobile fullscreen menu, glossary CTA badge ("1001 Terms"), language switcher
- **`SiteBreadcrumb.vue`** — 7 dilde, anasayfa hariç tüm sayfalarda; BreadcrumbList JSON-LD inline
- **`SiteFooter.vue`** — full + compact varyantları, 15 hizmet liste, sosyal medya
- **`HomeJourney.vue`** — 12-beat scrollytelling, Vue 3.5 `hydrateOnVisible` (TBT optimizasyonu)
- **`PageProgressBar.vue`** — sayfa yükleme feedback'i
- **`LanguageSwitcher.vue`** — 7 dil dropdown, hard-navigation switch

### Layoutlar

- **`default.vue`** — header + main + footer (en yaygın)
- **`form.vue`** — header + breadcrumb + dar rail + compact footer (career, kısa form)
- Landing variant — `tv`, `sunum` sayfaları için (transparent header, no footer)

### Animation principles

- **Lenis** smooth scroll (idle-init, sayfa hazır olduktan sonra)
- **`content-visibility: auto`** — büyük section'larda paint optimizasyonu
- **Respect `prefers-reduced-motion`** — scrollytelling otomatik kapanır
- **Page transitions DEVRE DIŞI** — `[page].vue` dynamic route'ta beyaz sayfa bug'ı tetikliyordu; `<PageProgressBar>` görsel feedback sağlıyor

---

## 9. Performans & PageSpeed yatırımları

Hedef: **Lighthouse Mobile ≥ 90**, Desktop ≥ 95.

### Network & assets

- **AVIF + WebP** image — `@nuxt/image` quality 80
- **Brotli** server-side compression (Cloudflare)
- **HTTP/3 (QUIC)** Cloudflare edge
- **`<link rel="preload">`** — kritik fontlar (700, 900) + LCP image
- **`<link rel="preconnect">`** + **`dns-prefetch`** — Google Tag Gateway domain'ine

### Render

- **Self-hosted fonts** — Google Fonts CSS roundtrip yok (3 saved cold-mobile RTT)
- **Critical CSS inline** — Tailwind purge sonrası 26 KB unused CSS temizlendi
- **`content-visibility: auto`** — fold-altı section'lar ilk paint'e dahil değil
- **Vue 3.5 lazy hydration** — HomeJourney `hydrateOnVisible` ile TBT -1500ms

### JavaScript

- **Tree shaking** — Vite + esbuild
- **Code splitting** — Nuxt route-level chunks
- **`drop: ['console','debugger']`** production build
- **Lenis idle-init** — `requestIdleCallback` ile smooth scroll geç başlar

### Caching

- **Static asset cache** — `Cache-Control: public, max-age=31536000, immutable` (`/_nuxt/`)
- **HTML cache** — `s-maxage=600, stale-while-revalidate=86400`
- **bf-cache compatible** — `unload` listener'lar temizlendi

### Sonuç (April 2026 ölçümü)

- TBT: 2190ms → < 200ms
- LCP: 10.6s → < 2.5s
- FCP: 8.1s → < 1.8s
- CLS: ≈ 0 (font fallback metrics)

---

## 10. Analytics & Tag stack

### First-party Google Tag Gateway

Klasik `gtag.js` 3rd-party domain çağrısı yerine **Cloudflare Workers üzerinden first-party proxy**:

- **GTM Container ID:** `GTM-KVX54H4M`
- **GA4 Measurement ID:** `G-C4ZX1F54Z0`
- **Endpoint:** `https://www.roibase.com.tr/metrics` (Cloudflare Worker)
- **Avantaj:** Ad-blocker bypass, daha hızlı yükleme, cookie domain match

### SPA tracking

- Page transition'larda `gtm.client` event manuel push edilir (`composables/useGtm.ts`)
- Double-count fix uygulanmış (history popstate event filtering)

### Custom event'ler

- `form_success` — iletişim formu başarılı submit (Ads conversion'a bağlı)
- `glossary_search` — sözlük search box etkileşimi
- `language_switch` — dil değişimi
- `cta_click` — primary CTA etkileşimi

---

## 11. Form / İletişim altyapısı

### Mail driver dual-strategy

```env
MAIL_DRIVER=resend     # ya da 'smtp'
RESEND_API_KEY=re_...
SMTP_HOST=...          # Resend yoksa fallback
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=hello@roibase.com.tr
MAIL_TO=hello@roibase.com.tr
```

- **Resend** — production default (REST API, deliverability avantajı)
- **SMTP/Nodemailer** — fallback ya da geliştirme

### Endpoint'ler

- `POST /api/contact` — form submit
- `GET /api/mail-health?token=...` — token-protected health check (502 troubleshoot için)

### Tracking

Form submit başarılı olduğunda `dataLayer.push({ event: 'form_success', form_id: 'contact' })` atılır → GTM → GA4 + Google Ads conversion.

### İletişim sayfası UX

- 7 dilde tam çevrilmiş alanlar
- Bütçe tier dropdown (entry / growth / enterprise)
- Telefon: +90 542 575 74 57 (7 dilde aynı)
- Office hours, harita, sosyal medya linkleri

---

## 12. Deployment & CI

### Hosting

- **Production: Outplane** (Paketo buildpacks, node-start)
- **Alternative: Cloudflare Pages** (`NITRO_PRESET=cloudflare-pages`, wrangler)
- **DNS:** Cloudflare (apex → www 301 redirect rule)

### Build pipeline

```bash
npm run prebuild        # split_i18n.py + build_glossary.py
npm run build           # nuxt build (node-server preset)
node .output/server/index.mjs   # Outplane'in çağırdığı entry
```

`prebuild` script:
1. `python3 scripts/split_i18n.py` — `i18n/master.json` → 7 dosyaya split
2. `python3 scripts/build_glossary.py` — master glossary → `data/glossary.json`

### Cloudflare deploy

```bash
npm run deploy:cf       # build:cf + wrangler pages deploy
```

### Build süresi

- Per-term detay sayfaları kaldırıldıktan sonra: **~10 dakika** (1 saatten düşürüldü)
- 147 prerendered sayfa + 22 LLMs.txt + sitemap = ~170 statik dosya

---

## 13. Önemli URL'ler — hızlı referans

### Site

- Anasayfa: https://www.roibase.com.tr/tr (default lang) ya da https://www.roibase.com.tr
- Sözlük: https://www.roibase.com.tr/tr/glossary
- Hakkımızda: https://www.roibase.com.tr/tr/hakkimizda
- İletişim: https://www.roibase.com.tr/tr/iletisim

### SEO

- **Sitemap:** https://www.roibase.com.tr/sitemap.xml
- **Robots:** https://www.roibase.com.tr/robots.txt

### LLMs.txt — AI crawler dokümantasyonu

**Navigasyonel (kısa, link hub):**
- https://www.roibase.com.tr/llms.txt (multi-lang root)
- https://www.roibase.com.tr/llms-tr.txt
- https://www.roibase.com.tr/llms-en.txt
- https://www.roibase.com.tr/llms-de.txt
- https://www.roibase.com.tr/llms-es.txt
- https://www.roibase.com.tr/llms-fr.txt
- https://www.roibase.com.tr/llms-it.txt
- https://www.roibase.com.tr/llms-ru.txt

**Encyclopedic (full corpus, içerik):**
- https://www.roibase.com.tr/llms-full.txt
- https://www.roibase.com.tr/llms-full-tr.txt
- https://www.roibase.com.tr/llms-full-en.txt
- https://www.roibase.com.tr/llms-full-de.txt
- https://www.roibase.com.tr/llms-full-es.txt
- https://www.roibase.com.tr/llms-full-fr.txt
- https://www.roibase.com.tr/llms-full-it.txt
- https://www.roibase.com.tr/llms-full-ru.txt

**Glossary inventory (1001 terim alfabetik):**
- https://www.roibase.com.tr/llms-glossary-tr.txt
- https://www.roibase.com.tr/llms-glossary-en.txt
- https://www.roibase.com.tr/llms-glossary-de.txt
- https://www.roibase.com.tr/llms-glossary-es.txt
- https://www.roibase.com.tr/llms-glossary-fr.txt
- https://www.roibase.com.tr/llms-glossary-it.txt
- https://www.roibase.com.tr/llms-glossary-ru.txt

### Sosyal medya & dış

- LinkedIn: https://www.linkedin.com/company/roibase/
- Instagram: https://www.instagram.com/roibaseagency/
- Email: hello@roibase.com.tr
- Telefon: +90 542 575 74 57

---

*Bu dokümantasyon, Roibase Nuxt 3 projesinin teknik mimarisini, içerik stratejisini ve operasyonel detaylarını özetler. Yeni geliştirici onboarding'i, kurumsal sunum, partner brief ve AI crawler context dokümanı olarak kullanılabilir.*

*Son güncelleme: Mayıs 2026 · 1001 terim · 7 dil · 147 prerendered sayfa · 22 LLMs.txt dosyası*
