<script setup lang="ts">
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '~/config/locales'

const route = useRoute()
const { locale } = useT()
const articleAlternates = useArticleAlternates()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

/**
 * Hedef dile geçiş URL'i. Üç senaryoyu yönetir:
 *
 *  1) Makale sayfasında ve hedef dilde çevirisi VAR
 *     → çevirinin gerçek path'ini kullan (slug farklı olabilir).
 *     örn: /tr/ai/roibase-blog-acilisi → /en/ai/roibase-blog-launch
 *
 *  2) Makale sayfasında ama hedef dilde çevirisi YOK
 *     → kullanıcıyı hedef dilin KATEGORİ sayfasına yönlendir
 *     (404 yerine en yakın anlamlı sayfa).
 *     örn: /tr/ai/x → çevirisi yok → /en/ai
 *
 *  3) Anasayfa / kategori / diğer sayfalar (article state boş)
 *     → mevcut path'in ilk segmentini değiştir (slug korunarak).
 *     örn: /tr/ai → /en/ai
 */
function hrefFor(target: Locale): string {
  const alts = articleAlternates.value
  const path = route.fullPath

  // Senaryo 1: makale + çeviri var
  if (alts?.paths?.[target]) {
    return alts.paths[target]!
  }

  const segments = path.split('/').filter(Boolean)

  // Senaryo 2: makale + çeviri yok → kategori fallback
  // Path en az 3 segment'liyse makaledeyiz: [lang, category, slug]
  if (alts && segments.length >= 3 && !alts.paths?.[target]) {
    return `/${target}/${segments[1]}`
  }

  // Senaryo 3: makale dışı → ilk segment swap
  if (segments.length >= 1 && SUPPORTED_LOCALES.includes(segments[0] as Locale)) {
    segments[0] = target
    return `/${segments.join('/')}`
  }

  return `/${target}`
}

onClickOutside(root, () => { isOpen.value = false })
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="text-sm font-mono uppercase tracking-wider text-gray-300 hover:text-pCyan flex items-center gap-1"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
    >
      {{ locale }}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 8L2 4h8z" />
      </svg>
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 mt-2 min-w-[180px] rounded-md bg-surface text-white shadow-lg ring-1 ring-white/10 py-1 z-50"
    >
      <a
        v-for="l in SUPPORTED_LOCALES"
        :key="l"
        :href="hrefFor(l)"
        class="block px-4 py-2 text-sm hover:bg-white/5"
        :class="{ 'text-pCyan': l === locale }"
      >
        <span class="font-mono uppercase mr-2">{{ l }}</span>
        <span class="text-gray-300">{{ LOCALE_LABELS[l] }}</span>
        <span
          v-if="articleAlternates && !articleAlternates.paths?.[l] && l !== locale"
          class="ml-1 text-[10px] text-gray-500"
          title="Bu makalenin çevirisi henüz yok — kategori sayfasına yönlendirilirsiniz"
        >·</span>
      </a>
    </div>
  </div>
</template>
