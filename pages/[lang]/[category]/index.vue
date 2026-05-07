<script setup lang="ts">
import { isValidCategory, CATEGORY_COLORS, type Category } from '~/config/categories'
import { isValidLocale } from '~/config/locales'

const route = useRoute()
const { t, locale } = useT()

const lang = route.params.lang as string
const category = route.params.category as string

if (!isValidLocale(lang) || !isValidCategory(category)) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

// Kategori sayfası makale değil — payload'daki article-alternates'i sıfırla.
await loadArticleAlternates(null)

const { data: posts } = await useAsyncData(`cat-${lang}-${category}`, () =>
  queryContent(`/${lang}/${category}`)
    .sort({ publishedAt: -1 })
    .find()
)

const categoryName = computed(() => t(`categories.${category}.name`))
const categoryDescription = computed(() => t(`categories.${category}.description`))
const categoryColor = computed(() => CATEGORY_COLORS[category as Category] ?? '#22d3ee')

useBlogSeo({
  title: `${categoryName.value} · Roibase Blog`,
  description: categoryDescription.value,
  path: category,
  locale: locale.value
})
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <SiteBreadcrumb
      :items="[
        { label: t('nav.home'), href: `/${lang}` },
        { label: categoryName }
      ]"
    />

    <header
      class="border-l-4 pl-6 mb-12"
      :style="{ borderColor: categoryColor }"
    >
      <p
        class="font-mono text-xs uppercase tracking-widest mb-2 font-bold"
        :style="{ color: categoryColor }"
      >
        {{ category }}
      </p>
      <h1 class="text-4xl md:text-5xl font-black tracking-tight">{{ categoryName }}</h1>
      <p class="mt-3 text-lg text-gray-600 dark:text-gray-400 max-w-2xl">{{ categoryDescription }}</p>
      <p class="mt-4 font-mono text-sm text-gray-500">
        <span class="font-bold" :style="{ color: categoryColor }">{{ posts?.length ?? 0 }}</span>
        {{ t('blog.articleCount') }}
      </p>
    </header>

    <div v-if="posts && posts.length" class="grid md:grid-cols-2 gap-8">
      <ArticleCard v-for="post in posts" :key="post._path" :article="post" />
    </div>
    <p v-else class="text-gray-500">{{ t('blog.noPosts') }}</p>
  </div>
</template>
