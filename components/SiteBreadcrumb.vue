<script setup lang="ts">
interface Crumb {
  label: string
  href?: string
}

defineProps<{
  items: Crumb[]
}>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="text-sm text-gray-500 mb-6">
    <ol class="flex items-center flex-wrap gap-1.5">
      <li v-for="(item, idx) in items" :key="idx" class="flex items-center gap-1.5">
        <NuxtLink v-if="item.href && idx < items.length - 1" :to="item.href" class="hover:text-pCyan transition">
          {{ item.label }}
        </NuxtLink>
        <span v-else class="text-gray-700 dark:text-gray-300">{{ item.label }}</span>
        <span v-if="idx < items.length - 1" aria-hidden="true">/</span>
      </li>
    </ol>
  </nav>
</template>
