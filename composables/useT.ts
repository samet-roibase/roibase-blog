// Lightweight i18n composable — ana sitenin useT pattern'inin sadeleştirilmiş hali.
// i18n modülü yerine doğrudan master.json'dan dot-path ile string okur.
// Bundle'a tek bir JSON ekler (modül runtime overhead yok).

import master from '~/i18n/master.json'
import type { Locale } from '~/config/locales'
import { DEFAULT_LOCALE, isValidLocale } from '~/config/locales'

type LocaleData = Record<string, unknown>

export function useT() {
  const route = useRoute()

  const locale = computed<Locale>(() => {
    const raw = (route.params.lang as string | undefined) ?? DEFAULT_LOCALE
    return isValidLocale(raw) ? raw : DEFAULT_LOCALE
  })

  const dict = computed<LocaleData>(() => {
    return ((master as Record<string, LocaleData>)[locale.value] ?? master[DEFAULT_LOCALE]) as LocaleData
  })

  function t(path: string, fallback = ''): string {
    const segments = path.split('.')
    let cursor: unknown = dict.value
    for (const segment of segments) {
      if (cursor && typeof cursor === 'object' && segment in (cursor as Record<string, unknown>)) {
        cursor = (cursor as Record<string, unknown>)[segment]
      } else {
        return fallback || path
      }
    }
    return typeof cursor === 'string' ? cursor : (fallback || path)
  }

  return { t, locale, dict }
}
