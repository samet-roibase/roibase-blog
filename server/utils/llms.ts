// LLMs.txt builder — AI crawler dokümantasyon altyapısı.
//
// İki çıktı türü:
//   1. Navigasyonel (kısa, link-yoğun) → buildLlmsNav(event, locale)
//      Site overview + kategori listesi + tüm makale URL'leri + lead description.
//      LLM'ler bunu "site haritası" olarak kullanır.
//
//   2. Encyclopedic (uzun, content-yoğun) → buildLlmsFull(event, locale)
//      Her makalenin tam metni — title, frontmatter meta, body Markdown'a
//      serialize edilmiş. LLM'ler bunu "full corpus" olarak alır, atıfta
//      bulunduğunda tam içeriği bilir.
//
// Multi-lang root hub'lar (locale=null) tüm dillerin LLMs URL'lerini
// listeler — entry point.

import { serverQueryContent } from '#content/server'
import { SUPPORTED_LOCALES, type Locale } from '~/config/locales'
import { CATEGORIES } from '~/config/categories'

// ParsedContent type'ı için minimal interface
interface ContentItem {
  _path?: string
  title?: string
  description?: string
  category?: string
  publishedAt?: string
  modifiedAt?: string
  i18nKey?: string
  readingTime?: number
  tags?: string[]
  body?: unknown
}

/**
 * Nuxt Content body AST'sini düz Markdown text'e dönüştürür.
 * Body sadece okunabilir özet için — full reproduction değil.
 */
function nodeToMarkdown(node: unknown): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(nodeToMarkdown).join('')

  const n = node as { type?: string; tag?: string; value?: string; children?: unknown[] }

  if (n.type === 'text' && typeof n.value === 'string') return n.value
  if (!Array.isArray(n.children)) return ''

  const inner = n.children.map(nodeToMarkdown).join('')

  switch (n.tag) {
    case 'h1': return `\n# ${inner}\n\n`
    case 'h2': return `\n## ${inner}\n\n`
    case 'h3': return `\n### ${inner}\n\n`
    case 'h4': return `\n#### ${inner}\n\n`
    case 'p':  return `${inner}\n\n`
    case 'li': return `- ${inner}\n`
    case 'ul':
    case 'ol': return `${inner}\n`
    case 'strong':
    case 'b':  return `**${inner}**`
    case 'em':
    case 'i':  return `*${inner}*`
    case 'code': return `\`${inner}\``
    case 'pre':  return `\n\`\`\`\n${inner}\n\`\`\`\n\n`
    case 'a':
      // Link metnini koru (URL'i kaybetmeyiz çünkü çoğunlukla iç link)
      return inner
    case 'blockquote': return `> ${inner}\n\n`
    case 'br': return '\n'
    case 'hr': return '\n---\n\n'
    default:   return inner
  }
}

/** SSR-side query helper — tek dilin tüm makalelerini çeker. */
async function fetchArticles(event: unknown, locale: Locale): Promise<ContentItem[]> {
  const arts = await serverQueryContent(event as never, `/${locale}`)
    .sort({ publishedAt: -1 })
    .find()
  return arts as unknown as ContentItem[]
}

/** Multi-lang root navigational hub */
export function buildLlmsRoot(siteUrl: string): string {
  const lines: string[] = [
    '# Roibase Blog — Multi-language LLM index',
    '',
    `Site: ${siteUrl}`,
    'About: Roibase\'in 7-dilli teknoloji blog\'u. AI, Marketing, Tech, Data, Gaming, Travel, Lifestyle.',
    '',
    '## Per-language navigational indexes',
    ''
  ]
  for (const l of SUPPORTED_LOCALES) {
    lines.push(`- ${l.toUpperCase()}: ${siteUrl}/llms-${l}.txt`)
  }
  lines.push('', '## Per-language full corpus', '')
  for (const l of SUPPORTED_LOCALES) {
    lines.push(`- ${l.toUpperCase()} (full): ${siteUrl}/llms-full-${l}.txt`)
  }
  lines.push('', '## Sitemap', `- ${siteUrl}/sitemap.xml`, '')
  return lines.join('\n')
}

/** Multi-lang root full hub — same idea, full corpus URLs. */
export function buildLlmsFullRoot(siteUrl: string): string {
  const lines: string[] = [
    '# Roibase Blog — Multi-language full corpus index',
    '',
    `Site: ${siteUrl}`,
    'About: Per-language encyclopedic dump of every article (title + frontmatter + full body Markdown).',
    '',
    '## Available corpora',
    ''
  ]
  for (const l of SUPPORTED_LOCALES) {
    lines.push(`- ${l.toUpperCase()}: ${siteUrl}/llms-full-${l}.txt`)
  }
  lines.push('', '## Companion resources', '')
  lines.push(`- Navigational: ${siteUrl}/llms.txt`)
  lines.push(`- Sitemap: ${siteUrl}/sitemap.xml`, '')
  return lines.join('\n')
}

/** Per-locale navigational LLMs.txt — short, link-heavy. */
export async function buildLlmsNav(event: unknown, locale: Locale, siteUrl: string): Promise<string> {
  const articles = await fetchArticles(event, locale)
  const langPrefix = `${siteUrl}/${locale}`

  const lines: string[] = [
    `# Roibase Blog — ${locale.toUpperCase()}`,
    '',
    `Homepage: ${langPrefix}`,
    `Language: ${locale}`,
    `Total articles: ${articles.length}`,
    '',
    '## About Roibase',
    'Roibase, performans pazarlamasını mühendislik disiplinine bağlayan butik dijital ajans. İstanbul, 2026. www.roibase.com.tr',
    '',
    '## Categories',
    ''
  ]

  for (const cat of CATEGORIES) {
    const catArts = articles.filter((a) => a.category === cat)
    lines.push(`- ${cat}: ${langPrefix}/${cat} (${catArts.length} articles)`)
  }

  lines.push('', '## All articles', '')
  for (const a of articles) {
    if (!a._path || !a.title) continue
    const desc = a.description ? ` — ${a.description}` : ''
    lines.push(`- [${a.title}](${siteUrl}${a._path})${desc}`)
  }

  lines.push('', '## Cross-references', '')
  lines.push(`- Full corpus (this language): ${siteUrl}/llms-full-${locale}.txt`)
  lines.push(`- Sitemap: ${siteUrl}/sitemap.xml`)
  lines.push(`- Roibase main site: https://www.roibase.com.tr`, '')

  return lines.join('\n')
}

/** Per-locale full corpus — every article, full body in Markdown. */
export async function buildLlmsFull(event: unknown, locale: Locale, siteUrl: string): Promise<string> {
  const articles = await fetchArticles(event, locale)
  const langPrefix = `${siteUrl}/${locale}`

  const lines: string[] = [
    `# Roibase Blog — ${locale.toUpperCase()} — Full corpus`,
    '',
    `Homepage: ${langPrefix}`,
    `Language: ${locale}`,
    `Total articles: ${articles.length}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    'This file contains every article in this language as Markdown — frontmatter',
    'metadata + body. AI crawlers and LLMs may use this for retrieval and citation.',
    '',
    '---',
    ''
  ]

  for (const a of articles) {
    if (!a._path || !a.title) continue

    lines.push(`## ${a.title}`)
    lines.push('')
    lines.push(`- URL: ${siteUrl}${a._path}`)
    lines.push(`- Category: ${a.category ?? '—'}`)
    lines.push(`- Published: ${a.publishedAt ?? '—'}`)
    if (a.modifiedAt) lines.push(`- Modified: ${a.modifiedAt}`)
    if (a.readingTime) lines.push(`- Reading time: ${a.readingTime} min`)
    if (a.tags && Array.isArray(a.tags) && a.tags.length) {
      lines.push(`- Tags: ${a.tags.join(', ')}`)
    }
    if (a.i18nKey) lines.push(`- i18nKey: ${a.i18nKey}`)
    lines.push('')
    if (a.description) {
      lines.push(`> ${a.description}`)
      lines.push('')
    }

    // Body markdown — recursive from parsed AST
    const bodyMd = nodeToMarkdown(a.body)
    lines.push(bodyMd.trim())
    lines.push('', '---', '')
  }

  return lines.join('\n')
}
