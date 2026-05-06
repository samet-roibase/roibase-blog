/**
 * Roibase Blog — desteklenen diller (ana site ile birebir aynı set).
 *
 * Bir dil eklemek/çıkarmak istersen:
 *   1) Bu listeye ekle/çıkar.
 *   2) i18n/master.json içine yeni dilin key bloğunu ekle.
 *   3) content/{lang}/ klasörünü ve örnek makaleyi oluştur.
 *   4) build sırasında server/routes/sitemap.xml.ts ve robots otomatik picked up.
 */

export const SUPPORTED_LOCALES = ['tr', 'en', 'de', 'es', 'fr', 'it', 'ru'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'tr'

/** Dil kodlarının native isimleri — language switcher için. */
export const LOCALE_LABELS: Record<Locale, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ru: 'Русский'
}

export function isValidLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
