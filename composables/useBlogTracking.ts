// Blog GTM dataLayer tracking — iki event:
//
//   1. view_content       — makale sayfası ilk hidrasyonda
//   2. blog_to_website    — Roibase ana sitesine (roibase.com.tr) giden
//                           bir <a> tıklandığında. Document-level click
//                           handler ile yakalanır → markdown body içindeki
//                           dinamik linkler de dahil.
//
// dataLayer push'u GTM container yüklenmeden önce gelse bile sorun değil:
// GTM yüklendiğinde mevcut array'i sırayla işler.

import type { Locale } from '~/config/locales'

interface BlogContext {
  contentName?: string
  contentCategory?: string
  contentLocale: Locale | string
}

function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer ?? []
  w.dataLayer.push(payload)
}

/**
 * Makale sayfası ilk açılışında 'view_content' event'i fire eder.
 *
 * Parametreler (GTM tag tarafında bu key'ler kullanılır):
 *   - content_name      → yazının başlığı
 *   - content_category  → yazının kategorisi (slug, örn 'ai')
 *   - content_locale    → dil kodu (örn 'tr')
 */
export function useViewContentEvent(opts: BlogContext): void {
  onMounted(() => {
    pushDataLayer({
      event: 'view_content',
      content_name: opts.contentName ?? '',
      content_category: opts.contentCategory ?? '',
      content_locale: opts.contentLocale
    })
  })
}

/**
 * Blog'tan Roibase ana sitesine (roibase.com.tr) giden TÜM linklere
 * tıklandığında 'blog_to_website' event'i fire eder. Document-level click
 * handler + capture: true → makale gövdesindeki Markdown'dan render edilen
 * dinamik <a> tag'leri dahil her shareable link bağlam'ı korur.
 *
 * Parametreler:
 *   - content_name      → o anda görüntülenen yazının başlığı
 *   - content_category  → yazının kategorisi
 *   - content_locale    → dil
 *   - click_text        → linkin görünür text'i (anchor text)
 *   - click_url         → tam absolute URL
 *   - click_category    → ana site path'inden çıkarılan hizmet slug'ı
 *                         (örn /tr/geo → 'geo', /en/ppc → 'ppc')
 *
 * Sayfa unmount'unda handler temizlenir → SPA navigasyonunda leak yok.
 */
export function useBlogToWebsiteTracking(opts: BlogContext): void {
  function handler(e: MouseEvent): void {
    const target = e.target as HTMLElement | null
    if (!target) return
    const link = target.closest('a') as HTMLAnchorElement | null
    if (!link) return

    // Resolved absolute URL ('href' DOM property mutlak hale çevirir)
    const href = link.href
    if (!href) return

    // Sadece Roibase ana sitesine giden linkler. Blog kendi içine
    // (blog.roibase.com.tr) ya da başka domain'lere giden linkler skip.
    if (!href.includes('roibase.com.tr')) return
    if (href.includes('blog.roibase.com.tr')) return

    // click_category → ana site URL'inin path'inden hizmet slug'ı.
    // Beklenen format: https://www.roibase.com.tr/{lang}/{service}
    // Eğer locale prefix yoksa (anasayfa veya farklı yapı) ilk segment.
    let clickCategory = ''
    try {
      const url = new URL(href)
      const segs = url.pathname.split('/').filter(Boolean)
      if (segs.length >= 2) clickCategory = segs[1]
      else if (segs.length === 1) clickCategory = segs[0]
    } catch {
      // Invalid URL → click_category boş kalır
    }

    pushDataLayer({
      event: 'blog_to_website',
      content_name: opts.contentName ?? '',
      content_category: opts.contentCategory ?? '',
      content_locale: opts.contentLocale,
      click_text: (link.textContent ?? '').trim(),
      click_url: href,
      click_category: clickCategory
    })
  }

  onMounted(() => {
    document.addEventListener('click', handler, { capture: true })
  })

  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', handler, { capture: true })
    }
  })
}
