<script setup lang="ts">
import { CATEGORIES, CATEGORY_COLORS } from '~/config/categories'
import { isValidLocale } from '~/config/locales'

const route = useRoute()
const { t, locale } = useT()

if (!isValidLocale(route.params.lang as string)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported locale' })
}

// Bu sayfa makale değil — payload'daki article-alternates'i null'a sıfırla,
// LanguageSwitcher varsayılan path swap behavior'ına dönsün.
await loadArticleAlternates(null)

// Latest articles across all categories for this locale (max 50).
const { data: latest } = await useAsyncData(`latest-${locale.value}`, () =>
  queryContent(`/${locale.value}`)
    .sort({ publishedAt: -1 })
    .limit(50)
    .find()
)

// Kategori başına makale sayısı — current locale bazında. Aynı i18nKey'in
// 7 dilde farklı dosyaları olsa bile, her locale'de tek dosya = 1 sayım.
// Bu kullanıcının ana sayfada gördüğü "kategoride X yazı" sayısıyla
// kategori sayfasına girince gördüğü kart sayısının eşleşmesini garantiler.
const { data: categoryCounts } = await useAsyncData(`cat-counts-${locale.value}`, async () => {
  const all = await queryContent(`/${locale.value}`)
    .only(['_path', 'category'])
    .find()
  const counts: Record<string, number> = {}
  for (const cat of CATEGORIES) counts[cat] = 0
  for (const a of all) {
    if (a.category && counts[a.category] !== undefined) {
      counts[a.category]++
    }
  }
  return counts
})

useBlogSeo({
  title: `Roibase Blog · ${t('site.tagline')}`,
  description: t('site.tagline'),
  path: '',
  locale: locale.value
})
</script>

<template>
  <div>
    <!-- Hero -->
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

    <!-- Body -->
    <section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <!-- Renkli kategori grid — mobil menü dilini desktop'a taşıdık -->
      <p class="kicker mb-4">{{ t('nav.categories') }}</p>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-16">
        <NuxtLink
          v-for="cat in CATEGORIES"
          :key="cat"
          :to="`/${locale}/${cat}`"
          class="group relative block overflow-hidden rounded-lg border border-gray-200 dark:border-white/10 transition"
          :style="{ '--cat-color': CATEGORY_COLORS[cat] }"
        >
          <!-- Sol kenar renkli stripe — hover'da geniş genişler -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5"
            :style="{ background: CATEGORY_COLORS[cat] }"
          />
          <div class="relative p-4 pl-5">
            <p
              class="font-mono text-[10px] uppercase tracking-widest mb-1 font-bold"
              :style="{ color: CATEGORY_COLORS[cat] }"
            >
              {{ cat }}
            </p>
            <p class="font-bold mt-0.5 text-sm group-hover:translate-x-0.5 transition-transform">
              {{ t(`categories.${cat}.name`) }}
            </p>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 font-mono">
              <span class="font-bold" :style="{ color: CATEGORY_COLORS[cat] }">
                {{ categoryCounts?.[cat] ?? 0 }}
              </span>
              {{ t('blog.articleCount') }}
            </p>
          </div>
        </NuxtLink>
      </div>

      <!-- Latest 50 articles -->
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
