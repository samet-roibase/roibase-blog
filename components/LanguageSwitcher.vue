<script setup lang="ts">
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from '~/config/locales'

const route = useRoute()
const { locale } = useT()

const isOpen = ref(false)
const root = ref<HTMLElement | null>(null)

// route.fullPath = /tr/ai/some-article
// switching to "en" → /en/ai/some-article. Hard navigation = doğru locale
// için yeni runtime context (i18n dict) yüklenir.
function hrefFor(target: Locale): string {
  const path = route.fullPath
  const segments = path.split('/')
  if (segments.length >= 2 && SUPPORTED_LOCALES.includes(segments[1] as Locale)) {
    segments[1] = target
    return segments.join('/') || `/${target}`
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
      class="absolute right-0 mt-2 min-w-[160px] rounded-md bg-surface text-white shadow-lg ring-1 ring-white/10 py-1 z-50"
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
      </a>
    </div>
  </div>
</template>
