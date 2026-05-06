import { defineEventHandler, setHeader } from 'h3'
import { serverQueryContent } from '#content/server'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '~/config/locales'
import { CATEGORIES } from '~/config/categories'

// Sitemap with full hreflang xhtml:link alternates so Google can map each
// URL to its sister pages across all 7 locales. Crawlers without hreflang
// support still see the standard <url> entries.

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')
  const noindex = config.public.noindex === true || config.public.noindex === 'true'

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600')

  // While in noindex mode we still emit the sitemap (useful for internal
  // crawls) but with no entries — protects against accidental discovery.
  if (noindex) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.w3.org/1999/sitemap-image/0.9"></urlset>'
    ].join('\n')
  }

  const articles = await serverQueryContent(event).find()
  const today = new Date().toISOString().slice(0, 10)

  type Entry = { paths: Record<string, string>; priority: number }
  const entries: Entry[] = []

  // Locale index pages.
  entries.push({
    paths: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}`])),
    priority: 1.0
  })

  // Category index pages.
  for (const cat of CATEGORIES) {
    entries.push({
      paths: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}/${cat}`])),
      priority: 0.8
    })
  }

  // Article pages — articles only have an entry per locale they actually
  // exist in, so hreflang alternates only list the locales that have a
  // localized version. Group by category+slug across locales.
  const grouped = new Map<string, Record<string, string>>()
  for (const a of articles) {
    if (!a._path || typeof a._path !== 'string') continue
    const segments = a._path.split('/').filter(Boolean)
    if (segments.length < 3) continue
    const [lang, category, ...slugParts] = segments
    const slug = slugParts.join('/')
    const groupKey = `${category}/${slug}`
    const langGroup = grouped.get(groupKey) ?? {}
    langGroup[lang] = a._path
    grouped.set(groupKey, langGroup)
  }
  for (const [, langPaths] of grouped) {
    entries.push({ paths: langPaths, priority: 0.7 })
  }

  const xml: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.w3.org/1999/sitemap-image/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ]

  for (const entry of entries) {
    // Canonical = default locale's path if present, else first available.
    const canonicalLang = entry.paths[DEFAULT_LOCALE] ? DEFAULT_LOCALE : Object.keys(entry.paths)[0]
    const canonical = entry.paths[canonicalLang]
    xml.push('  <url>')
    xml.push(`    <loc>${siteUrl}${canonical}</loc>`)
    xml.push(`    <lastmod>${today}</lastmod>`)
    xml.push('    <changefreq>weekly</changefreq>')
    xml.push(`    <priority>${entry.priority.toFixed(1)}</priority>`)
    for (const [lang, path] of Object.entries(entry.paths)) {
      xml.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${siteUrl}${path}" />`)
    }
    // x-default → default locale's URL if present.
    if (entry.paths[DEFAULT_LOCALE]) {
      xml.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${entry.paths[DEFAULT_LOCALE]}" />`)
    }
    xml.push('  </url>')
  }

  xml.push('</urlset>')
  return xml.join('\n')
})
