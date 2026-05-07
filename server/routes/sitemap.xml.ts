import { defineEventHandler, setHeader } from 'h3'
import { serverQueryContent } from '#content/server'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '~/config/locales'
import { CATEGORIES } from '~/config/categories'

// Sitemap with full hreflang xhtml:link alternates so Google can map each
// URL to its sister pages across all locales.
//
// Article grouping uses i18nKey (NOT path) — slug'lar dilden dile farklı
// olduğu için path-bazlı grouping çevirileri birleştiremiyordu. Aynı
// i18nKey'e sahip tüm dosyalar = aynı makalenin farklı dil sürümleri.
//
// CRITICAL: xmlns "http://www.sitemaps.org/schemas/sitemap/0.9" — önceki
// hatalı "sitemap-image/0.9" namespace Google tarafından reddedilmişti.

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600')

  const articles = await serverQueryContent(event)
    .only(['_path', 'category', 'i18nKey', 'publishedAt', 'modifiedAt'])
    .find()
  const today = new Date().toISOString().slice(0, 10)

  type Entry = {
    paths: Record<string, string>
    priority: number
    changefreq: string
    lastmod: string
  }
  const entries: Entry[] = []

  // Locale index pages — anasayfalar
  entries.push({
    paths: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}`])),
    priority: 1.0,
    changefreq: 'daily',
    lastmod: today
  })

  // Category index pages
  for (const cat of CATEGORIES) {
    entries.push({
      paths: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}/${cat}`])),
      priority: 0.8,
      changefreq: 'daily',
      lastmod: today
    })
  }

  // Article pages — group by i18nKey (KRİTİK: slug çevirileri farklı olduğu
  // için path bazlı grouping çevirileri birleştiremezdi).
  const grouped = new Map<string, { paths: Record<string, string>; lastmod: string }>()
  for (const a of articles) {
    if (!a._path || typeof a._path !== 'string') continue
    if (!a.i18nKey) continue
    const segments = a._path.split('/').filter(Boolean)
    if (segments.length < 3) continue
    const lang = segments[0]
    if (!SUPPORTED_LOCALES.includes(lang as (typeof SUPPORTED_LOCALES)[number])) continue

    const group = grouped.get(a.i18nKey) ?? {
      paths: {},
      lastmod: a.modifiedAt ?? a.publishedAt ?? today
    }
    group.paths[lang] = a._path
    // Pick the most recent modifiedAt across the cluster
    const candidate = a.modifiedAt ?? a.publishedAt
    if (candidate && candidate > group.lastmod) group.lastmod = candidate
    grouped.set(a.i18nKey, group)
  }

  for (const { paths, lastmod } of grouped.values()) {
    entries.push({
      paths,
      priority: 0.7,
      changefreq: 'weekly',
      lastmod: lastmod.slice(0, 10)
    })
  }

  const xml: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ]

  for (const entry of entries) {
    // Canonical = default locale path if present, else first available.
    const canonicalLang = entry.paths[DEFAULT_LOCALE] ? DEFAULT_LOCALE : Object.keys(entry.paths)[0]
    const canonical = entry.paths[canonicalLang]
    if (!canonical) continue

    xml.push('  <url>')
    xml.push(`    <loc>${siteUrl}${canonical}</loc>`)
    xml.push(`    <lastmod>${entry.lastmod}</lastmod>`)
    xml.push(`    <changefreq>${entry.changefreq}</changefreq>`)
    xml.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
    for (const [lang, path] of Object.entries(entry.paths)) {
      xml.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${siteUrl}${path}" />`)
    }
    if (entry.paths[DEFAULT_LOCALE]) {
      xml.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${entry.paths[DEFAULT_LOCALE]}" />`)
    }
    xml.push('  </url>')
  }

  xml.push('</urlset>')
  return xml.join('\n')
})
