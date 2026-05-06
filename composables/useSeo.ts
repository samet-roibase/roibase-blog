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
}

export function useBlogSeo(opts: SeoOptions) {
  const { public: pub } = useRuntimeConfig()
  const siteUrl = (pub.siteUrl as string).replace(/\/$/, '')
  const cleanPath = opts.path.replace(/^\/|\/$/g, '')
  const canonicalPath = cleanPath ? `/${opts.locale}/${cleanPath}` : `/${opts.locale}`
  const canonical = `${siteUrl}${canonicalPath}`

  const alternates = SUPPORTED_LOCALES.map((l) => ({
    rel: 'alternate',
    hreflang: l,
    href: `${siteUrl}${cleanPath ? `/${l}/${cleanPath}` : `/${l}`}`
  }))

  // x-default → siteyi ilk açan, dilini bilemediğimiz kullanıcıya gönderdiğimiz versiyon.
  const xDefault = {
    rel: 'alternate',
    hreflang: 'x-default',
    href: `${siteUrl}${cleanPath ? `/${pub.defaultLocale}/${cleanPath}` : `/${pub.defaultLocale}`}`
  }

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
      xDefault
    ],
    script: (opts.jsonLd ?? []).map((payload) => ({
      type: 'application/ld+json',
      innerHTML: JSON.stringify(payload)
    }))
  })

  return { canonical, alternates, siteUrl }
}
