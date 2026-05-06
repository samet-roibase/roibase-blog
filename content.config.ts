// Frontmatter şeması — tüm makaleler bu alanları taşımalı.
// Bu dosya şu an Nuxt Content tarafından runtime'da kullanılmıyor (v2 schema
// validation external değil), ama otomasyon (n8n + Claude API) için
// referans niteliğinde tutuluyor. v3'e geçildiğinde defineCollection ile aktif edilir.

export interface ArticleFrontmatter {
  title: string
  description: string
  publishedAt: string  // ISO date "YYYY-MM-DD"
  modifiedAt?: string
  category: 'ai' | 'marketing' | 'tech' | 'data' | 'gaming' | 'travel' | 'lifestyle'
  /**
   * Cross-language identifier — aynı i18nKey'e sahip tüm dosyalar AYNI
   * makalenin farklı dil sürümleridir. LanguageSwitcher ve hreflang
   * altyapısı bu key üzerinden mapping kurar; slug'ların dilden dile
   * farklı olmasına izin verir (örn. /tr/ai/blog-acilisi vs.
   * /en/ai/blog-launch).
   *
   * Format önerisi: "<kategori>-<özet-slug>-<yyyy-mm>"
   *   örn: "ai-roibase-blog-launch-2026-05"
   * n8n otomasyonu yeni içerik üretirken bu key'i tüm 7 dil için
   * tek seferde belirleyip her dosyaya basar.
   */
  i18nKey: string
  tags?: string[]
  readingTime?: number
  author?: string
  /** Kapak görseli (opsiyonel) — /public altında bir path */
  cover?: string
  /** AI engine atıfları için yapılandırılmış FAQ */
  faq?: Array<{ q: string; a: string }>
}
