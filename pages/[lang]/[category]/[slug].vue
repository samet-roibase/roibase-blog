<script setup lang="ts">
import { isValidCategory } from '~/config/categories'
import { isValidLocale } from '~/config/locales'

const route = useRoute()
const { t, locale } = useT()
const { public: pub } = useRuntimeConfig()

const lang = route.params.lang as string
const category = route.params.category as string
const slug = route.params.slug as string

if (!isValidLocale(lang) || !isValidCategory(category)) {
  throw createError({ statusCode: 404, statusMessage: 'Not found' })
}

const path = `/${lang}/${category}/${slug}`

const { data: article } = await useAsyncData(`article-${path}`, () =>
  queryContent(path).findOne()
)

if (!article.value) {
  throw createError({ statusCode: 404, statusMessage: 'Article not found' })
}

const categoryName = computed(() => t(`categories.${category}.name`))

const articleJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: article.value?.title,
  description: article.value?.description,
  datePublished: article.value?.publishedAt,
  dateModified: article.value?.modifiedAt ?? article.value?.publishedAt,
  inLanguage: lang,
  author: {
    '@type': 'Organization',
    name: pub.siteName
  },
  publisher: {
    '@type': 'Organization',
    name: pub.siteName,
    logo: { '@type': 'ImageObject', url: `${pub.siteUrl}/logo.png` }
  },
  mainEntityOfPage: `${pub.siteUrl}${path}`
}))

const breadcrumbJsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: t('nav.home'), item: `${pub.siteUrl}/${lang}` },
    { '@type': 'ListItem', position: 2, name: categoryName.value, item: `${pub.siteUrl}/${lang}/${category}` },
    { '@type': 'ListItem', position: 3, name: article.value?.title, item: `${pub.siteUrl}${path}` }
  ]
}))

useBlogSeo({
  title: article.value.title,
  description: article.value.description ?? '',
  path: `${category}/${slug}`,
  locale: locale.value,
  article: {
    publishedAt: article.value.publishedAt,
    modifiedAt: article.value.modifiedAt
  },
  jsonLd: [articleJsonLd.value, breadcrumbJsonLd.value]
})

const dateLabel = computed(() => {
  if (!article.value?.publishedAt) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(article.value.publishedAt))
  } catch {
    return article.value.publishedAt
  }
})
</script>

<template>
  <article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <SiteBreadcrumb
      :items="[
        { label: t('nav.home'), href: `/${lang}` },
        { label: categoryName, href: `/${lang}/${category}` },
        { label: article?.title ?? '' }
      ]"
    />

    <header class="mb-10">
      <p class="kicker mb-3">{{ categoryName }}</p>
      <h1 class="text-4xl md:text-5xl font-black tracking-tight leading-tight">{{ article?.title }}</h1>
      <p v-if="article?.description" class="mt-4 text-xl text-gray-600 dark:text-gray-400">{{ article.description }}</p>
      <div class="mt-6 flex items-center gap-3 text-sm text-gray-500 font-mono">
        <time v-if="dateLabel" :datetime="article?.publishedAt">{{ dateLabel }}</time>
        <span v-if="article?.readingTime">· {{ article.readingTime }} {{ t('blog.minRead') }}</span>
      </div>
    </header>

    <div class="prose prose-lg dark:prose-invert max-w-none">
      <ContentRenderer v-if="article" :value="article" />
    </div>
  </article>
</template>
