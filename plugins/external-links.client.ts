// External links → target="_blank" + rel="noopener noreferrer"
//
// Amaç: Blog'tan dışarı çıkan her link yeni tab'da açılsın. Kullanıcı
// blog'u terk etmek zorunda kalmasın.
//
// Kapsam:
//   • External: protokollü (https://, http://) ve blog.roibase.com.tr
//     dışındaki tüm linkler → _blank
//   • Internal: relative path (/tr/ai), aynı host, anchor (#), mailto:,
//     tel: → DOKUNULMAZ (NuxtLink default davranış korunur)
//
// Mekanizma: client-only plugin. Document'a ilk yüklemede + her route
// change'de + her DOM mutation'ında tarama. ContentRenderer markdown'dan
// render ederken yeni eklenen <a>'lar da yakalanır.
//
// Performans: MutationObserver subtree:true sadece eklenen node'larda
// link var mı diye check eder; tüm DOM'u her seferinde taramaz.

export default defineNuxtPlugin(() => {
  if (typeof document === 'undefined') return

  function markExternalLinks(root: ParentNode = document) {
    const links = root.querySelectorAll('a[href]')
    for (const link of Array.from(links) as HTMLAnchorElement[]) {
      const href = link.getAttribute('href')
      if (!href) continue

      // Internal patterns — dokunma
      if (
        href.startsWith('/') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('javascript:')
      ) continue

      // Aynı host (blog.roibase.com.tr) — internal sayılır
      try {
        const url = new URL(href, window.location.href)
        if (url.host === window.location.host) continue
      } catch {
        // Invalid URL, skip
        continue
      }

      // External — target + rel set et (idempotent: zaten varsa overwrite etmez)
      if (link.getAttribute('target') !== '_blank') {
        link.setAttribute('target', '_blank')
      }
      const rel = link.getAttribute('rel') ?? ''
      const relParts = new Set(rel.split(/\s+/).filter(Boolean))
      relParts.add('noopener')
      relParts.add('noreferrer')
      link.setAttribute('rel', Array.from(relParts).join(' '))
    }
  }

  // 1) İlk hidrasyonda tüm sayfayı tara
  markExternalLinks()

  // 2) SPA route change sonrası — yeni sayfa render edildi
  const router = useRouter()
  router.afterEach(() => {
    requestAnimationFrame(() => markExternalLinks())
  })

  // 3) Dinamik DOM mutations — özellikle ContentRenderer'ın markdown'dan
  //    yeni <a> render etmesi için. childList + subtree, eklenen her node'da
  //    link var mı kontrol → tüm DOM'u her mutation'da taramaktan kaçın.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== 'childList') continue
      for (const node of Array.from(m.addedNodes)) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue
        const el = node as Element
        if (el.tagName === 'A' || el.querySelector?.('a[href]')) {
          markExternalLinks(el as ParentNode)
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
})
