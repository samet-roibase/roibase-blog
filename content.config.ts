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
  tags?: string[]
  readingTime?: number
  author?: string
  /** Kapak görseli (opsiyonel) — /public altında bir path */
  cover?: string
  /** AI engine atıfları için yapılandırılmış FAQ */
  faq?: Array<{ q: string; a: string }>
}
