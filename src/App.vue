<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const showBackButton = computed(() => route.name !== 'home' && route.name !== 'login')

function onGoBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({ name: 'home' })
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <main class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div v-if="showBackButton" class="mb-4">
        <button
          type="button"
          class="cursor-pointer rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
          @click="onGoBack"
        >
          ← {{ t('common.back') }}
        </button>
      </div>
      <RouterView />
    </main>
  </div>
</template>
