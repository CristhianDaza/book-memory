<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { setAppLocale, type AppLocale } from '../i18n'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'

const appStore = useAppStore()
const authStore = useAuthStore()
const router = useRouter()
const { t, locale } = useI18n()

const { appName, mobileFirst } = storeToRefs(appStore)
const { user } = storeToRefs(authStore)
const currentLocale = computed(() => locale.value as AppLocale)
const nextLocale = computed<AppLocale>(() => (currentLocale.value === 'es' ? 'en' : 'es'))
const nextLocaleLabel = computed(() =>
  nextLocale.value === 'es' ? t('common.spanish') : t('common.english'),
)

async function onLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

function onChangeLocale(nextLocale: AppLocale) {
  setAppLocale(nextLocale)
}
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg sm:p-8">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('common.bookMemory') }}</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">{{ t('home.title') }}</h1>
          <p class="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            {{ t('home.subtitle') }}
          </p>
        </div>
        <div class="flex items-center gap-2">
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
      </div>

      <dl class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-400">{{ t('home.app') }}</dt>
          <dd class="mt-1 text-base font-medium text-slate-100">{{ appName }}</dd>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-400">{{ t('home.uiStrategy') }}</dt>
          <dd class="mt-1 text-base font-medium text-emerald-300">
            {{ mobileFirst ? t('home.mobileFirstEnabled') : t('home.notConfigured') }}
          </dd>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-slate-400">{{ t('home.signedUser') }}</dt>
          <dd class="mt-1 text-sm font-medium text-slate-100">
            {{ user?.email ?? t('home.fallbackUser') }}
          </dd>
        </div>
      </dl>
    </section>

    <nav class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/books"
      >
        {{ t('home.books') }}
      </RouterLink>
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/reading"
      >
        {{ t('home.reading') }}
      </RouterLink>
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/stats"
      >
        {{ t('home.stats') }}
      </RouterLink>
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/"
      >
        {{ t('home.home') }}
      </RouterLink>
    </nav>
  </div>
</template>
