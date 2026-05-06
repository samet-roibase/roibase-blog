<script setup lang="ts">
import { DEFAULT_LOCALE } from '~/config/locales'

// Root path is redirected via nuxt.config routeRules to /{DEFAULT_LOCALE},
// but we keep this stub so the dev server has a valid index. SSR will rarely
// reach it because the route rule kicks in first.
await navigateTo(`/${DEFAULT_LOCALE}`, { redirectCode: 301 })
</script>

<template>
  <div />
</template>
