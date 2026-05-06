<!--
  SiteHeader — global header.

  Mobile menu, ana sitenin (roibase.com.tr) fullscreen overlay
  tasarımının blog'a adapte edilmiş halidir:
   - Teleport'ed to <body> (z-[9999]), header'ın stacking context'inden çıkar
   - Dark bg + dotted radial grid + diagonal cyan accent band (asymmetric)
   - Hero kicker "— Menu / 7 Categories" + büyük başlık
   - 7 kategori asimetrik rail'lerde, her birinin kendi rengi (CATEGORY_COLORS)
   - CTA footer: ana site link + lang switcher + meta
-->
<script setup lang="ts">
import { CATEGORIES, CATEGORY_COLORS } from '~/config/categories'
import siteConfig from '~/config/site.json'

const { t, locale } = useT()
const route = useRoute()

const isOpen = ref(false)
function toggle() { isOpen.value = !isOpen.value }
function close() { isOpen.value = false }

watch(() => route.fullPath, close)

// ESC kapatır
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => {
  if (import.meta.client) window.addEventListener('keydown', onEsc)
})
onBeforeUnmount(() => {
  if (import.meta.client) window.removeEventListener('keydown', onEsc)
})

// Body scroll kilidi
watch(isOpen, (v) => {
  if (import.meta.client) {
    document.documentElement.style.overflow = v ? 'hidden' : ''
  }
})

const homeHref = computed(() => `/${locale.value}`)
function categoryHref(slug: string) {
  return `/${locale.value}/${slug}`
}

const totalCategories = CATEGORIES.length
</script>

<template>
  <header class="sticky top-0 z-40 bg-dark/95 backdrop-blur supports-[backdrop-filter]:bg-dark/80 text-white border-b border-white/10">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Brand -->
        <NuxtLink :to="homeHref" class="flex items-baseline gap-2 font-black text-xl tracking-tight">
          <span>ROIBASE<span class="text-pCyan">.</span></span>
          <span class="text-pCyan font-mono text-xs uppercase tracking-widest">blog</span>
        </NuxtLink>

        <!-- Desktop nav -->
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

        <!-- Right: lang + mobile toggle -->
        <div class="flex items-center gap-4">
          <LanguageSwitcher />
          <button
            type="button"
            class="md:hidden p-2 -mr-2 relative z-[201]"
            :aria-expanded="isOpen"
            aria-label="Menu"
            @click="toggle"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path v-if="!isOpen" d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round" />
              <path v-else d="M6 6l12 12M6 18l12-12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ===========================================================
         Mobile — FULLSCREEN overlay, ana site mobile menu adaptasyonu.
         Teleport'ed to <body> ki sticky header'ın stacking context'inden
         çıksın (z-[9999] direkt body üzerinde).
         =========================================================== -->
    <Teleport to="body">
      <Transition name="mobilenav">
        <div
          v-if="isOpen"
          class="md:hidden fixed inset-0 z-[9999] overflow-y-auto overflow-x-hidden overscroll-contain bg-dark text-white"
          role="dialog"
          aria-modal="true"
        >
          <!-- Dotted radial grid background -->
          <div
            class="pointer-events-none absolute inset-0 opacity-[0.07]"
            style="background-image: radial-gradient(#ffffff 1px, transparent 1px); background-size: 20px 20px;"
          />

          <!-- Diagonal cyan accent band — top-right asymmetric -->
          <div
            class="pointer-events-none absolute -top-24 -right-32 w-[130vw] h-60 origin-top-right rotate-[4deg] bg-gradient-to-br from-white/[0.06] via-pCyan/[0.08] to-transparent"
          />
          <div
            class="pointer-events-none absolute top-[9.2rem] -right-10 w-[115vw] h-px origin-top-right rotate-[4deg] bg-gradient-to-r from-transparent via-pCyan/40 to-transparent"
          />

          <!-- ============== HERO TOP STRIP ============== -->
          <div class="relative h-16 flex items-center justify-between px-5">
            <NuxtLink :to="homeHref" class="flex items-baseline gap-2" @click="close">
              <span class="text-lg font-black tracking-tighter">ROIBASE<span class="text-pCyan">.</span></span>
              <span class="text-pCyan font-mono text-[10px] uppercase tracking-widest">blog</span>
            </NuxtLink>
            <button
              type="button"
              aria-label="Close menu"
              class="p-2 text-white/80 hover:text-pCyan transition-colors"
              @click="close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" />
              </svg>
            </button>
          </div>

          <!-- ============== HERO HEADLINE BLOCK ============== -->
          <div class="relative px-5 pt-7 pb-5">
            <p lang="en" class="font-mono text-[10px] tracking-[0.28em] text-pCyan uppercase">
              — Menu / {{ totalCategories }} Categories
            </p>
            <h2 class="mt-2 text-5xl font-black leading-[0.92] tracking-tighter">
              {{ t('nav.categories') }}<span class="text-pCyan">.</span>
            </h2>
            <p class="mt-3 text-[13px] text-gray-400 max-w-xs leading-relaxed">
              {{ t('site.tagline') }}
            </p>
          </div>

          <!-- ============== 7 ASYMMETRIC CATEGORY RAILS ============== -->
          <div class="relative">
            <div
              v-for="(cat, idx) in CATEGORIES"
              :key="cat"
              class="relative border-t border-white/10 py-6 pr-5"
              :style="{ paddingLeft: `${20 + idx * 6}px` }"
            >
              <!-- Colored vertical stripe -->
              <div
                class="absolute top-6 bottom-6 left-0 w-[3px] rounded-full"
                :style="{ background: CATEGORY_COLORS[cat] }"
              />

              <NuxtLink
                :to="categoryHref(cat)"
                class="group flex items-start gap-4 pl-5 active:opacity-70"
                @click="close"
              >
                <div class="flex-1 min-w-0">
                  <p
                    class="font-mono text-[10px] tracking-[0.28em] uppercase font-bold mb-2"
                    :style="{ color: CATEGORY_COLORS[cat] }"
                  >
                    {{ String(idx + 1).padStart(2, '0') }} — {{ cat }}
                  </p>
                  <h3 class="text-2xl font-black leading-tight tracking-tight group-hover:text-pCyan transition-colors">
                    {{ t(`categories.${cat}.name`) }}
                  </h3>
                  <p class="text-[12px] text-white/55 mt-1 leading-snug">
                    {{ t(`categories.${cat}.description`) }}
                  </p>
                </div>
                <span
                  class="text-xl font-mono self-center opacity-0 group-hover:opacity-100 transition-opacity"
                  :style="{ color: CATEGORY_COLORS[cat] }"
                >
                  →
                </span>
              </NuxtLink>
            </div>
          </div>

          <!-- ============== CTA FOOTER ============== -->
          <div class="relative bg-surface mt-4 px-6 pt-10 pb-8 overflow-hidden border-t border-white/10">
            <!-- Decorative cyan corner -->
            <div class="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-pCyan/10 blur-2xl" />
            <div class="pointer-events-none absolute -top-16 -right-20 w-64 h-64 rounded-full bg-white/[0.04] blur-3xl" />

            <p class="relative font-mono text-[10px] tracking-[0.28em] uppercase text-white/40 mb-6">
              — Roibase
            </p>

            <ul class="relative space-y-4 mb-8">
              <li>
                <a
                  :href="siteConfig.mainSiteUrl"
                  rel="noopener"
                  class="group flex items-center justify-between"
                >
                  <span class="text-2xl font-black tracking-tight group-active:text-pCyan transition-colors">
                    Roibase
                  </span>
                  <span class="text-pCyan text-xl">↗</span>
                </a>
              </li>
              <li>
                <a
                  :href="`mailto:${siteConfig.contactEmail}`"
                  class="group flex items-center justify-between"
                >
                  <span class="text-base font-mono tracking-tight text-white/80 group-active:text-pCyan transition-colors">
                    {{ siteConfig.contactEmail }}
                  </span>
                  <span class="text-pCyan text-xl">→</span>
                </a>
              </li>
            </ul>

            <!-- Bottom meta row -->
            <div class="relative pt-5 border-t border-white/10 flex items-center justify-between">
              <LanguageSwitcher />
              <span class="font-mono text-[10px] tracking-[0.24em] uppercase text-white/40">
                ROIBASE · BLOG
              </span>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<style scoped>
/* Mobile nav enter/leave — slide + crossfade */
.mobilenav-enter-active,
.mobilenav-leave-active {
  transition: opacity 220ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.mobilenav-enter-from,
.mobilenav-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
}
.mobilenav-enter-to,
.mobilenav-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .mobilenav-enter-active,
  .mobilenav-leave-active {
    transition: opacity 120ms ease;
  }
  .mobilenav-enter-from,
  .mobilenav-leave-to {
    transform: none;
  }
}
</style>
