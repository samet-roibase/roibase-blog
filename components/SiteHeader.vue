<script setup lang="ts">
import { CATEGORIES } from '~/config/categories'

const { t, locale } = useT()
const route = useRoute()

const isOpen = ref(false)
function toggle() { isOpen.value = !isOpen.value }
function close() { isOpen.value = false }

watch(() => route.fullPath, close)

const homeHref = computed(() => `/${locale.value}`)
function categoryHref(slug: string) {
  return `/${locale.value}/${slug}`
}
</script>

<template>
  <header class="sticky top-0 z-40 bg-dark/95 backdrop-blur supports-[backdrop-filter]:bg-dark/80 text-white border-b border-white/10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <NuxtLink :to="homeHref" class="flex items-baseline gap-2 font-black text-xl tracking-tight">
          <span>ROIBASE</span>
          <span class="text-pCyan font-mono text-xs uppercase tracking-widest">blog</span>
        </NuxtLink>

        <nav class="hidden md:flex items-center gap-6 text-sm">
          <NuxtLink
            v-for="cat in CATEGORIES"
            :key="cat"
            :to="categoryHref(cat)"
            class="text-gray-300 hover:text-pCyan transition"
          >
            {{ t(`categories.${cat}.name`) }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-4">
          <LanguageSwitcher />
          <button
            type="button"
            class="md:hidden p-2 -mr-2"
            :aria-expanded="isOpen"
            aria-label="Menu"
            @click="toggle"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path v-if="!isOpen" d="M4 6h16M4 12h16M4 18h16" />
              <path v-else d="M6 6l12 12M6 18l12-12" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="isOpen" class="md:hidden pb-4 border-t border-white/10 pt-4">
        <nav class="flex flex-col gap-3">
          <NuxtLink
            v-for="cat in CATEGORIES"
            :key="cat"
            :to="categoryHref(cat)"
            class="text-gray-300 hover:text-pCyan py-1"
            @click="close"
          >
            {{ t(`categories.${cat}.name`) }}
          </NuxtLink>
        </nav>
      </div>
    </div>
  </header>
</template>
