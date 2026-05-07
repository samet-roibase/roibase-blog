<script setup lang="ts">
import type { ParsedContent } from '@nuxt/content/dist/runtime/types'
import { CATEGORY_COLORS, type Category } from '~/config/categories'

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

const href = computed(() => props.article._path ?? '#')

const dateLabel = computed(() => {
  if (!props.article.publishedAt) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long' }).format(new Date(props.article.publishedAt))
  } catch {
    return props.article.publishedAt
  }
})

// Kategori rengi — kicker + feature variant border
const categoryColor = computed(() =>
  props.article.category ? CATEGORY_COLORS[props.article.category as Category] ?? '#22d3ee' : '#22d3ee'
)
</script>

<template>
  <article
    class="group"
    :class="variant === 'feature' ? 'border-l-4 pl-6' : ''"
    :style="variant === 'feature' ? { borderColor: categoryColor } : undefined"
  >
    <p
      v-if="article.category"
      class="font-mono text-xs uppercase tracking-widest mb-2"
      :style="{ color: categoryColor }"
    >
      {{ t(`categories.${article.category}.name`, article.category) }}
    </p>
    <h3
      class="font-bold tracking-tight transition"
      :class="variant === 'feature' ? 'text-3xl md:text-4xl' : 'text-xl'"
    >
      <NuxtLink :to="href" class="hover-cat-color" :style="{ '--cat-color': categoryColor }">
        {{ article.title }}
      </NuxtLink>
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

<style scoped>
.hover-cat-color {
  transition: color 0.15s ease;
}
.hover-cat-color:hover {
  color: var(--cat-color);
}
</style>
