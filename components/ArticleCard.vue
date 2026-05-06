<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'

interface Article extends ParsedContent {
  title?: string
  description?: string
  publishedAt?: string
  category?: string
  readingTime?: number
}

const props = defineProps<{
  article: Article
  variant?: 'feature' | 'standard'
}>()

const { locale, t } = useT()

const href = computed(() => {
  // _path looks like "/tr/ai/some-article" — Nuxt Content auto-derives from file path
  return props.article._path ?? '#'
})

const dateLabel = computed(() => {
  if (!props.article.publishedAt) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(props.article.publishedAt))
  } catch {
    return props.article.publishedAt
  }
})
</script>

<template>
  <article
    class="group"
    :class="variant === 'feature' ? 'border-l-4 border-pCyan pl-6' : ''"
  >
    <p v-if="article.category" class="kicker mb-2">{{ t(`categories.${article.category}.name`, article.category) }}</p>
    <h3
      class="font-bold tracking-tight group-hover:text-pCyan transition"
      :class="variant === 'feature' ? 'text-3xl md:text-4xl' : 'text-xl'"
    >
      <NuxtLink :to="href">{{ article.title }}</NuxtLink>
    </h3>
    <p v-if="article.description" class="mt-2 text-gray-600 dark:text-gray-400" :class="variant === 'feature' ? 'text-lg' : 'text-sm'">
      {{ article.description }}
    </p>
    <div class="mt-3 flex items-center gap-3 text-xs text-gray-500 font-mono">
      <time v-if="dateLabel" :datetime="article.publishedAt">{{ dateLabel }}</time>
      <span v-if="article.readingTime">· {{ article.readingTime }} {{ t('blog.minRead') }}</span>
    </div>
  </article>
</template>
