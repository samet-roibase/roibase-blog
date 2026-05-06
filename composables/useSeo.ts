// Per-page SEO helper — canonical, hreflang alternates, OpenGraph, JSON-LD.
// Tüm sayfa şablonları bunu çağırır; tek nokta = tek doğruluk.

import { SUPPORTED_LOCALES, type Locale } from '~/config/locales'

interface SeoOptions {
  title: string
  description: string
  /** Path WITHOUT locale prefix and WITHOUT leading slash. örn: "ai" veya "ai/some-article" */
  path: string
  locale: Locale
  /** Article-specific extras (article pages call with these). */
  article?: {
    publishedAt?: string
    modifiedAt?: string
    author?: string
    image?: string
  }
  /** Fully constructed JSON-LD payloads — Article, BreadcrumbList, FAQ, vb. */
  jsonLd?: Array<Record<string, unknown>>
  /**
   * Locale → full path map (locale prefix dahil, örn "/en/ai/foo-launch").
   * Sayfa için locale slug'ları diller arasında DEĞİŞİYORSA bu kullanılır
   * (özellikle makale sayfaları). Verilmezse otomatik üretim kullanılır:
   * "her dilde aynı path" varsayımıyla `/{lang}/{path}`.
   *
   * Alternate hreflang yalnızca bu map'te yer alan diller için emit edilir
   * → çevirisi olmayan diller hreflang'tan ÇIKARILIR (Google "broken
   * hreflang cluster" uyarısı vermez, 404 link basılmaz).
   */
  alternatesByLocale?: Partial<Record<Locale, string>>
}

export function useBlogSeo(opts: SeoOptions) {
  const { public: pub } = useRuntimeConfig()
  const siteUrl = (pub.siteUrl as string).replace(/\/$/, '')
  const cleanPath = opts.path.replace(/^\/|\/$/g, '')
  const canonicalPath = cleanPath ? `/${opts.locale}/${cleanPath}` : `/${opts.locale}`
  const canonical = `${siteUrl}${canonicalPath}`

  // Alternate URL'leri: ya çağıran tarafından verilen mapping (makale)
  // ya da otomatik (kategori, anasayfa).
  const localePathMap: Partial<Record<Locale, string>> = opts.alternatesByLocale
    ? opts.alternatesByLocale
    : Object.fromEntries(
        SUPPORTED_LOCALES.map((l) => [l, cleanPath ? `/${l}/${cleanPath}` : `/${l}`])
      )

  const alternates = (Object.entries(localePathMap) as Array<[Locale, string]>)
    .map(([lang, path]) => ({
      rel: 'alternate',
      hreflang: lang,
      href: `${siteUrl}${path}`
    }))

  // x-default: default locale çevirisi varsa onu kullan; yoksa ilk
  // alternates entry'sini default göster.
  const defaultLang = pub.defaultLocale as Locale
  const xDefaultPath = localePathMap[defaultLang] ?? Object.values(localePathMap)[0]
  const xDefault = xDefaultPath
    ? { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}${xDefaultPath}` }
    : null

  useSeoMeta({
    title: opts.title,
    description: opts.description,
    ogTitle: opts.title,
    ogDescription: opts.description,
    ogUrl: canonical,
    ogType: opts.article ? 'article' : 'website',
    ogSiteName: pub.siteName as string,
    ogLocale: opts.locale,
    twitterCard: 'summary_large_image',
    twitterTitle: opts.title,
    twitterDescription: opts.description,
    ...(opts.article?.publishedAt && { articlePublishedTime: opts.article.publishedAt }),
    ...(opts.article?.modifiedAt && { articleModifiedTime: opts.article.modifiedAt })
  })

  useHead({
    htmlAttrs: { lang: opts.locale },
    link: [
      { rel: 'canonical', href: canonical },
      ...alternates,
      ...(xDefault ? [xDefault] : [])
    ],
    script: (opts.jsonLd ?? []).map((payload) => ({
      type: 'application/ld+json',
      innerHTML: JSON.stringify(payload)
    }))
  })

  return { canonical, alternates, siteUrl }
}
