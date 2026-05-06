<script setup lang="ts">
import { CATEGORIES } from '~/config/categories'
import { isValidLocale } from '~/config/locales'

const route = useRoute()
const { t, locale } = useT()

if (!isValidLocale(route.params.lang as string)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported locale' })
}

// Bu sayfa makale değil — payload'daki article-alternates'i null'a sıfırla,
// LanguageSwitcher varsayılan path swap behavior'ına dönsün.
await loadArticleAlternates(null)

// Latest articles across all categories for this locale.
const { data: latest } = await useAsyncData(`latest-${locale.value}`, () =>
  queryContent(`/${locale.value}`)
    .sort({ publishedAt: -1 })
    .limit(9)
    .find()
)

useBlogSeo({
  title: `Roibase Blog · ${t('site.tagline')}`,
  description: t('site.tagline'),
  path: '',
  locale: locale.value
})
</script>

<template>
  <div>
    <section class="bg-dark text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <p class="kicker mb-4">Roibase</p>
        <h1 class="text-4xl md:text-6xl font-black tracking-tight max-w-3xl">
          {{ t('site.tagline') }}
        </h1>
        <p class="mt-6 text-lg text-gray-300 max-w-2xl">
          {{ t('blog.latestPosts') }} — AI · Marketing · Tech · Data · Gaming · Travel · Lifestyle.
        </p>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <p class="kicker mb-3">{{ t('nav.categories') }}</p>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-16">
        <NuxtLink
          v-for="cat in CATEGORIES"
          :key="cat"
          :to="`/${locale}/${cat}`"
          class="block p-4 rounded-lg border border-gray-200 dark:border-white/10 hover:border-pCyan hover:text-pCyan transition"
        >
          <p class="font-mono text-xs uppercase tracking-widest text-gray-500">{{ cat }}</p>
          <p class="font-bold mt-1">{{ t(`categories.${cat}.name`) }}</p>
        </NuxtLink>
      </div>

      <p class="kicker mb-6">{{ t('blog.latestPosts') }}</p>
      <div v-if="latest && latest.length" class="asym-grid">
        <ArticleCard
          v-for="(post, idx) in latest"
          :key="post._path"
          :article="post"
          :variant="idx === 0 ? 'feature' : 'standard'"
          :class="idx === 0 ? 'feature' : 'accent'"
        />
      </div>
      <p v-else class="text-gray-500">{{ t('blog.noPosts') }}</p>
    </section>
  </div>
</template>
