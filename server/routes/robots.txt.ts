import { defineEventHandler, setHeader } from 'h3'

// robots.txt — staging'de NUXT_PUBLIC_NOINDEX=true → tüm path'leri Disallow,
// production'a geçişte env'i NUXT_PUBLIC_NOINDEX=false yapınca normal allow'a döner.
// Belt-and-braces: meta robots tag de aynı flag'i okuyor (nuxt.config.ts).

export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const siteUrl = (config.public.siteUrl as string).replace(/\/$/, '')
  const noindex = config.public.noindex === true || config.public.noindex === 'true'

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600')

  if (noindex) {
    return [
      '# Roibase Blog — staging mode (noindex)',
      '# Lift this block by setting NUXT_PUBLIC_NOINDEX=false on production.',
      'User-agent: *',
      'Disallow: /',
      ''
    ].join('\n')
  }

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`,
    ''
  ].join('\n')
})
