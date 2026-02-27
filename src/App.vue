<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppNotifications from './components/AppNotifications.vue'
import { setAppLocale } from './i18n'
import type { AppLocale } from './types/i18n'
import { useAuthStore } from './stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

const showSectionNav = computed(() => route.name !== 'login')
const showUserControls = computed(() => route.name !== 'login')
const currentLocale = computed(() => locale.value as AppLocale)
const nextLocale = computed<AppLocale>(() => (currentLocale.value === 'es' ? 'en' : 'es'))
const nextLocaleLabel = computed(() =>
  nextLocale.value === 'es' ? t('common.spanish') : t('common.english'),
)

function onChangeLocale(next: AppLocale) {
  setAppLocale(next)
}

async function onLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <AppNotifications />
    <main class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div v-if="showUserControls" class="mb-3 flex items-center justify-end gap-2">
        <span class="text-xs uppercase tracking-wide text-slate-400">{{ t('common.language') }}</span>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          @click="onChangeLocale(nextLocale)"
        >
          {{ nextLocaleLabel }}
        </button>
        <button
          class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          @click="onLogout"
        >
          {{ t('home.signOut') }}
        </button>
      </div>

      <nav
        v-if="showSectionNav"
        class="mb-4 grid grid-cols-4 gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-2"
      >
        <RouterLink
          to="/"
          class="cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition"
          :class="route.name === 'home' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.home') }}
        </RouterLink>
        <RouterLink
          to="/books"
          class="cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition"
          :class="
            route.name === 'books' || route.name === 'book-detail'
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-200 hover:bg-slate-800'
          "
        >
          {{ t('home.books') }}
        </RouterLink>
        <RouterLink
          to="/reading"
          class="cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition"
          :class="route.name === 'reading' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.reading') }}
        </RouterLink>
        <RouterLink
          to="/stats"
          class="cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition"
          :class="route.name === 'stats' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.stats') }}
        </RouterLink>
      </nav>
      <RouterView />
    </main>
  </div>
</template>
