/**
 * Roibase Blog — 7 kategori, tek source of truth.
 *
 * Spec §2 (roibase_blog_specification.md): her hafta her kategoriden 1 yazı,
 * 7 dilde lokalize → 49 özgün × 7 = 343 yayın/hafta.
 *
 * Slug değişikliği yaparken bu listeyi güncelleyin — sayfa router validator,
 * sitemap ve i18n master.json bu listeyi referans alıyor.
 */

export const CATEGORIES = [
  'ai',
  'marketing',
  'tech',
  'data',
  'gaming',
  'travel',
  'lifestyle'
] as const

export type Category = (typeof CATEGORIES)[number]

export function isValidCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value)
}

/** İlgili Roibase ana hizmet sayfalarına iç linkleme için kategori → hizmet eşlemesi. */
export const CATEGORY_TO_SERVICES: Record<Category, readonly string[]> = {
  ai: ['geo', 'verianalizi'],
  marketing: ['dijitalpazarlama', 'ppc', 'cro'],
  tech: ['headless', 'shopify', 'ui-ux'],
  data: ['firstparty', 'verianalizi', 'retention-engineering-cdp'],
  gaming: ['aso', 'premiumyayinci'],
  travel: ['branding'],
  lifestyle: ['branding']
}
