// Nuxt 3 configuration — Roibase Blog
// - Outplane (node-server) default; cloudflare-pages override via NITRO_PRESET env
// - Nuxt Content v2 for Markdown-driven articles
// - Tailwind + @nuxt/image (AVIF) + @nuxt/fonts (Inter + JetBrains Mono self-hosted)
// - noindex flag (NUXT_PUBLIC_NOINDEX) controls robots.txt + meta robots tag
//   so the entire site can be hidden from search engines during staging.

import siteConfig from './config/site.json'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './config/locales'

const NITRO_PRESET = process.env.NITRO_PRESET || 'node-server'

// noindex defaults to TRUE — site is hidden from crawlers until we explicitly
// flip NUXT_PUBLIC_NOINDEX=false in production. This protects the staging
// build from being indexed before we are ready to launch.
const NOINDEX = process.env.NUXT_PUBLIC_NOINDEX !== 'false'

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || siteConfig.siteUrl,
      siteName: siteConfig.siteName,
      defaultLocale: DEFAULT_LOCALE,
      supportedLocales: SUPPORTED_LOCALES,
      contactEmail: siteConfig.contactEmail,
      noindex: NOINDEX
    }
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxt/image',
    '@nuxt/fonts',
    '@nuxt/content',
    '@vueuse/nuxt'
  ],

  content: {
    // Markdown articles live under content/{lang}/{category}/{slug}.md
    // Nuxt Content auto-discovers and exposes them via queryContent().
    highlight: {
      // pre background zaten dark (main.css'te theme.colors.dark) — light mode'da
      // bile koyu zemin kullandığımız için her iki modda da dark tema kullanıyoruz.
      // github-light + dark zemin = okunmaz; github-dark + dark zemin = okunaklı.
      theme: 'github-dark',
      preload: ['ts', 'js', 'json', 'bash', 'vue', 'html', 'css', 'sql', 'python']
    },
    markdown: {
      anchorLinks: { depth: 3 },
      toc: { depth: 3, searchDepth: 3 }
    }
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700, 900], styles: ['normal'], preload: true },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 700], styles: ['normal'], preload: true }
    ],
    defaults: { display: 'optional' }
  },

  css: ['~/assets/css/main.css'],

  app: {
    pageTransition: false,
    head: {
      htmlAttrs: { lang: DEFAULT_LOCALE, class: 'scroll-smooth' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0, viewport-fit=cover' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'theme-color', content: '#0b1120' },
        { name: 'color-scheme', content: 'light dark' },
        // STAGING noindex — flipped via NUXT_PUBLIC_NOINDEX=false at launch.
        // Belt-and-braces: robots.txt also Disallows everything while NOINDEX
        // is true, but compliant crawlers respect the meta tag too.
        ...(NOINDEX ? [{ name: 'robots', content: 'noindex, nofollow, noarchive' }] : [])
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // Performance: Roibase ana sitesine giden iç linkler için DNS pre-resolve.
        // Makale içinde "[hizmet adı](https://www.roibase.com.tr/...)" linklerine
        // hover/click zamanı geldiğinde DNS lookup gecikmesi olmaz.
        { rel: 'dns-prefetch', href: 'https://www.roibase.com.tr' },
        { rel: 'preconnect', href: 'https://www.roibase.com.tr', crossorigin: '' }
      ],
      // ---------------------------------------------------------------
      //  GOOGLE TAG MANAGER — first-party via Cloudflare Tag Gateway
      // ---------------------------------------------------------------
      //  Container: GTM-KVX54H4M (ana site ile AYNI — tek dashboard'ta blog
      //              + ana site trafiği birleştirilmiş ölçüm)
      //  Gateway path: /metrics (Cloudflare → Tag Management ayarı)
      //
      //  Ana siteyle birebir aynı first-party setup:
      //    • Bypasses ad-blockers (loads from same origin)
      //    • Bypasses ITP/Brave/Safari third-party cookie kısıtları
      //    • Cookies first-party kalır (longer lifetime)
      //
      //  PRODUCTION-ONLY: NODE_ENV !== production'da inject edilmez
      //  (dev console temiz kalır, fake event'ler raporları kirletmez).
      //
      //  KURULUM ŞARTI: Cloudflare → blog.roibase.com.tr için Tag Gateway
      //  forwarding kuralının kurulu olması gerek (/metrics/* → Google).
      //  "Set up tag" toggle'ı KAPALI olmalı — biz manuel inject ediyoruz.
      script: process.env.NODE_ENV === 'production' ? [
        {
          tagPosition: 'head',
          innerHTML:
            "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':" +
            "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0]," +
            "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=" +
            "'/metrics/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);" +
            "})(window,document,'script','dataLayer','GTM-KVX54H4M');"
        }
      ] : [],
      noscript: process.env.NODE_ENV === 'production' ? [
        {
          tagPosition: 'bodyOpen',
          innerHTML:
            '<iframe src="/metrics/ns.html?id=GTM-KVX54H4M" ' +
            'height="0" width="0" style="display:none;visibility:hidden" ' +
            'title="Google Tag Manager fallback"></iframe>'
        }
      ] : []
    }
  },

  image: {
    format: ['avif', 'webp'],
    quality: 80,
    densities: 'x1 x2',
    provider: process.env.NODE_ENV === 'production' ? 'ipxStatic' : 'ipx',
    screens: { xs: 320, sm: 640, md: 768, lg: 1024, xl: 1280, xxl: 1536 }
  },

  nitro: {
    preset: NITRO_PRESET,
    prerender: {
      crawlLinks: true,
      failOnError: false,
      // Initial routes — the rest are discovered via crawlLinks.
      // We seed every locale's index so the crawler can find category +
      // article pages from there.
      routes: [
        '/',
        '/sitemap.xml',
        '/robots.txt',
        ...SUPPORTED_LOCALES.map((l) => `/${l}`)
      ]
    },
    compressPublicAssets: { gzip: true, brotli: true },
    minify: true,
    routeRules: {
      '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/_fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/_ipx/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } }
    }
  },

  experimental: {
    payloadExtraction: true,
    renderJsonPayloads: true,
    asyncContext: true
  },

  features: {
    inlineStyles: true
  },

  routeRules: {
    '/': { redirect: { to: `/${DEFAULT_LOCALE}`, statusCode: 301 } }
  },

  vite: {
    build: {
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      assetsInlineLimit: 4096,
      minify: 'esbuild'
    },
    esbuild: {
      pure: process.env.NODE_ENV === 'production' ? ['console.log', 'console.debug'] : [],
      drop: process.env.NODE_ENV === 'production' ? ['debugger'] : []
    },
    // macOS + Node 24 üstünde Vite'ın esbuild dep-scan'i bazı sandbox/CI
    // ortamlarında "spawn EBADF" veriyor. Pre-bundling'i devre dışı
    // bırakmak dev başlangıcını yavaşlatır ama sorunsuz çalıştırır.
    // Production build (npm run build) etkilenmez — orada Rollup koşar.
    optimizeDeps: {
      noDiscovery: true,
      include: []
    }
  }
})
