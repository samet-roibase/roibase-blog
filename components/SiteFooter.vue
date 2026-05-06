<script setup lang="ts">
import { CATEGORIES } from '~/config/categories'
import siteConfig from '~/config/site.json'

const { t, locale } = useT()
const year = new Date().getFullYear()
</script>

<template>
  <footer class="bg-dark text-gray-300 mt-24">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid md:grid-cols-3 gap-8">
        <div>
          <p class="text-white font-black text-lg tracking-tight">ROIBASE <span class="text-pCyan font-mono text-xs uppercase tracking-widest">blog</span></p>
          <p class="text-sm mt-2">{{ t('site.tagline') }}</p>
        </div>

        <div>
          <p class="kicker mb-3">{{ t('nav.categories') }}</p>
          <ul class="space-y-1.5 text-sm">
            <li v-for="cat in CATEGORIES" :key="cat">
              <NuxtLink :to="`/${locale}/${cat}`" class="hover:text-pCyan transition">
                {{ t(`categories.${cat}.name`) }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <p class="kicker mb-3">Roibase</p>
          <ul class="space-y-1.5 text-sm">
            <li>
              <a :href="siteConfig.mainSiteUrl" rel="noopener" class="hover:text-pCyan transition">
                {{ t('footer.mainSite') }}
              </a>
            </li>
            <li>
              <a :href="`mailto:${siteConfig.contactEmail}`" class="hover:text-pCyan transition">
                {{ siteConfig.contactEmail }}
              </a>
            </li>
            <li>
              <a :href="siteConfig.social.linkedin" rel="noopener" class="hover:text-pCyan transition">LinkedIn</a>
            </li>
            <li>
              <a :href="siteConfig.social.instagram" rel="noopener" class="hover:text-pCyan transition">Instagram</a>
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-12 pt-6 border-t border-white/10 text-xs text-gray-500 flex flex-col sm:flex-row justify-between gap-2">
        <p>© {{ year }} Roibase. {{ t('footer.rights') }}</p>
        <p class="font-mono">{{ siteConfig.siteUrl.replace(/^https?:\/\//, '') }}</p>
      </div>
    </div>
  </footer>
</template>
