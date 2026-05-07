<script setup lang="ts">
import { isValidCategory, CATEGORY_COLORS, type Category } from '~/config/categories'
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

// i18nKey üstünden bu makalenin tüm dil sürümlerinin path'lerini topla.
// useAsyncData payload'a yazar (key: 'article-alternates'); switcher ve
// useBlogSeo aynı key'den useNuxtData ile okur. Slug çevirileri farklı
// olduğunda 404'ü ve broken hreflang'i önler.
await loadArticleAlternates(article.value.i18nKey)
const articleAlternates = useArticleAlternates()

const categoryName = computed(() => t(`categories.${category}.name`))
const categoryColor = computed(() => CATEGORY_COLORS[category as Category] ?? '#22d3ee')

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
  jsonLd: [articleJsonLd.value, breadcrumbJsonLd.value],
  alternatesByLocale: articleAlternates.value?.paths
})

// articleAlternates is now a ComputedRef<ArticleAlternates | null>;
// LanguageSwitcher reads it through the same useArticleAlternates() call,
// so we don't need to pass it down explicitly.

const dateLabel = computed(() => {
  if (!article.value?.publishedAt) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(article.value.publishedAt))
  } catch {
    return article.value.publishedAt
  }
})

// GTM dataLayer tracking — view_content + blog_to_website.
// view_content: makale ilk açılışında bir kez fire eder.
// blog_to_website: document-level click handler ile Roibase ana sitesine
// giden her tıklamada fire eder (markdown body içindeki linkler dahil).
const trackingContext = {
  contentName: article.value.title,
  contentCategory: category,
  contentLocale: lang
}
useViewContentEvent(trackingContext)
useBlogToWebsiteTracking(trackingContext)
</script>

<template>
  <article>
    <!-- Hero — dark, premium magazine cover feel -->
    <header class="bg-dark text-white border-b border-white/10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 md:pt-10 md:pb-24">
        <SiteBreadcrumb
          :items="[
            { label: t('nav.home'), href: `/${lang}` },
            { label: categoryName, href: `/${lang}/${category}` },
            { label: article?.title ?? '' }
          ]"
          class="mb-12 [&_*]:!text-gray-500 [&_a]:hover:!text-pCyan"
        />

        <NuxtLink :to="`/${lang}/${category}`" class="inline-block">
          <p
            class="font-mono text-xs uppercase tracking-widest mb-6 font-bold"
            :style="{ color: categoryColor }"
          >
            {{ categoryName }}
          </p>
        </NuxtLink>

        <h1 class="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
          {{ article?.title }}
        </h1>

        <p
          v-if="article?.description"
          class="mt-8 text-xl md:text-2xl text-gray-300 leading-relaxed max-w-2xl font-light"
        >
          {{ article.description }}
        </p>

        <div class="mt-12 flex flex-wrap items-center gap-3 text-sm font-mono text-gray-400">
          <time v-if="dateLabel" :datetime="article?.publishedAt">{{ dateLabel }}</time>
          <span v-if="article?.readingTime" class="text-gray-600">·</span>
          <span v-if="article?.readingTime">{{ article.readingTime }} {{ t('blog.minRead') }}</span>
          <span class="text-gray-600">·</span>
          <span class="uppercase tracking-wider">Roibase</span>
        </div>
      </div>
    </header>

    <!-- Body — light, magazine layout -->
    <div class="bg-white dark:bg-dark">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div class="article-body">
          <ContentRenderer v-if="article" :value="article" />
        </div>

        <!-- Article footer — meta + back to category + Roibase link -->
        <footer class="mt-24 pt-10 border-t border-gray-200 dark:border-white/10">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <p class="kicker mb-3">{{ t('blog.publishedOn') }}</p>
              <p class="text-gray-700 dark:text-gray-300 font-mono">{{ dateLabel }}</p>
            </div>
            <div>
              <p class="kicker mb-3">{{ t('nav.categories') }}</p>
              <NuxtLink
                :to="`/${lang}/${category}`"
                class="text-gray-700 dark:text-gray-300 hover:text-pCyan transition"
              >
                ← {{ categoryName }}
              </NuxtLink>
            </div>
            <div>
              <p class="kicker mb-3">Roibase</p>
              <a
                href="https://www.roibase.com.tr"
                rel="noopener"
                class="text-gray-700 dark:text-gray-300 hover:text-pCyan transition inline-flex items-center gap-1"
              >
                www.roibase.com.tr
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  </article>
</template>
