<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()

function handleError() {
  return clearError({ redirect: '/' })
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-dark text-white px-6">
    <div class="text-center max-w-xl">
      <p class="kicker mb-4">Roibase Blog</p>
      <h1 class="text-5xl font-black mb-4">{{ error.statusCode }}</h1>
      <p class="text-lg text-gray-300 mb-8">{{ error.message || 'Sayfa bulunamadı.' }}</p>
      <button
        type="button"
        class="px-6 py-3 bg-pCyan text-dark font-semibold rounded-md hover:bg-cyan-300 transition"
        @click="handleError"
      >
        Anasayfaya dön
      </button>
    </div>
  </div>
</template>
