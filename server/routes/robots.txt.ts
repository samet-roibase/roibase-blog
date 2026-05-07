import { defineEventHandler, setHeader } from 'h3'
import { SUPPORTED_LOCALES } from '~/config/locales'

// robots.txt — production. Site arama motorlarına AÇIK.
// LLM-Content directives ana sitenin (www.roibase.com.tr) modeli ile aynı
// — AI crawler'lar (ChatGPT, Perplexity, Gemini, Claude) için well-known-path
// discovery. 16 LLMs.txt endpoint'i (1 root + 7 nav + 1 full root + 7 full).

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600')

  const lines: string[] = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
    '# AI crawler hub — well-known LLM-Content path',
    `LLM-Content: ${siteUrl}/llms.txt`
  ]
  for (const l of SUPPORTED_LOCALES) {
    lines.push(`LLM-Content: ${siteUrl}/llms-${l}.txt`)
  }
  lines.push(`LLM-Content: ${siteUrl}/llms-full.txt`)
  for (const l of SUPPORTED_LOCALES) {
    lines.push(`LLM-Content: ${siteUrl}/llms-full-${l}.txt`)
  }
  lines.push('')

  return lines.join('\n')
})
