// Cross-language article alternates.
//
// Her makale frontmatter'ında bir i18nKey taşır. Aynı i18nKey'e sahip tüm
// Markdown dosyaları, aynı makalenin farklı dil sürümleridir. Bu composable
// makale sayfalarının dil değiştiriciye + SEO altyapısına "bu makalenin
// X dilindeki yolu şu" bilgisini paylaşmasını sağlar.
//
// Implementation note (2026-05): useState async setter Nuxt SSR pipeline
// tarafından payload'a yakalanmıyordu. Onun yerine useAsyncData ile
// SABIT bir cache key'e yazıyoruz; switcher ve SEO useNuxtData ile aynı
// key'den okuyor. Anasayfa / kategori sayfaları da aynı key'i null
// payload'la temizliyor ki eski makaleden state taşmasın.
//
// Akış:
//   1) [slug].vue: await loadArticleAlternates(article.i18nKey)
//   2) Payload'a yazılır (key: 'article-alternates')
//   3) LanguageSwitcher + useBlogSeo: useArticleAlternates() ile okur
//   4) Anasayfa / kategori: await loadArticleAlternates(null) → null payload

import type { Locale } from '~/config/locales'

export interface ArticleAlternates {
  i18nKey: string
  /** locale → full content path (örn "/en/ai/roibase-blog-launch"). */
  paths: Partial<Record<Locale, string>>
}

const PAYLOAD_KEY = 'article-alternates'

/** Switcher / SEO için: payload'dan alternates verisini okur. */
export function useArticleAlternates() {
  const nuxtData = useNuxtData<ArticleAlternates | null>(PAYLOAD_KEY)
  return computed<ArticleAlternates | null>(() => nuxtData.data.value ?? null)
}

/**
 * Sayfa setup'ında çağırılır — verilen i18nKey için tüm dil sürümlerinin
 * path mapping'ini hesaplar VE payload'a yazar. i18nKey null ise
 * payload'a null yazar (kategori / anasayfa böylece eski makale
 * state'ini temizler).
 */
export async function loadArticleAlternates(
  i18nKey: string | undefined | null
): Promise<void> {
  await useAsyncData<ArticleAlternates | null>(
    PAYLOAD_KEY,
    async () => {
      if (!i18nKey) return null
      const matches = await queryContent()
        .where({ i18nKey })
        .only(['_path'])
        .find()
      const paths: Partial<Record<Locale, string>> = {}
      for (const m of matches) {
        if (!m._path || typeof m._path !== 'string') continue
        const segments = m._path.split('/').filter(Boolean)
        if (segments.length < 1) continue
        paths[segments[0] as Locale] = m._path
      }
      return { i18nKey, paths }
    },
    { default: () => null }
  )
}
