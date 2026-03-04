<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { setAppLocale } from '../../../i18n'
import type { AppLocale } from '../../../types/i18n'
import { useAuthStore } from '../../../stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()

const { errorMessage, isAuthenticated, initializing } = storeToRefs(authStore)
const email = ref('')
const password = ref('')
const mode = ref<'login' | 'register'>('login')
const resetInfoMessage = ref<string | null>(null)
const redirecting = ref(false)
const currentLocale = computed(() => locale.value as AppLocale)
const nextLocale = computed<AppLocale>(() => (currentLocale.value === 'es' ? 'en' : 'es'))
const nextLocaleLabel = computed(() =>
  nextLocale.value === 'es' ? t('common.spanish') : t('common.english'),
)

function onChangeLocale(nextLocale: AppLocale) {
  setAppLocale(nextLocale)
}

async function navigateAfterAuth() {
  if (redirecting.value) return
  redirecting.value = true
  try {
    const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirectTarget)
  } finally {
    redirecting.value = false
  }
}

watch(
  isAuthenticated,
  async (authenticated) => {
    if (!authenticated) return
    await navigateAfterAuth()
  },
  { immediate: true },
)

async function onEmailSubmit() {
  if (mode.value === 'login') {
    await authStore.loginWithEmail(email.value, password.value)
  } else {
    await authStore.registerWithEmail(email.value, password.value)
  }
}

async function onGoogleSubmit() {
  await authStore.loginWithGoogle()
}

async function onResetPassword() {
  resetInfoMessage.value = null
  if (!email.value.trim()) {
    return
  }
  const sent = await authStore.sendPasswordReset(email.value.trim())
  if (sent) {
    resetInfoMessage.value = t('auth.passwordResetSent')
  }
}
</script>

<template>
  <section class="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">
        {{ t('auth.section') }}
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          @click="onChangeLocale(nextLocale)"
        >
          {{ nextLocaleLabel }}
        </button>
      </div>
    </div>

    <h1 class="mt-2 text-2xl font-semibold text-white">
      {{ t('auth.title') }}
    </h1>
    <p class="mt-2 text-sm text-slate-300">
      {{ t('auth.subtitle') }}
    </p>

    <form
      class="mt-6 space-y-3"
      @submit.prevent="onEmailSubmit"
    >
      <label class="block">
        <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{{ t('auth.email') }}</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2"
        >
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">{{ t('auth.password') }}</span>
        <input
          v-model="password"
          type="password"
          required
          minlength="6"
          autocomplete="current-password"
          class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2"
        >
      </label>

      <div class="flex gap-2">
        <button
          type="submit"
          class="flex-1 cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          {{ mode === 'login' ? t('auth.signInWithEmail') : t('auth.createAccount') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          @click="mode = mode === 'login' ? 'register' : 'login'"
        >
          {{ mode === 'login' ? t('auth.register') : t('auth.login') }}
        </button>
      </div>
    </form>

    <button
      type="button"
      class="mt-3 w-full cursor-pointer rounded-xl border border-emerald-500/60 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="initializing"
      @click="onGoogleSubmit"
    >
      {{ t('auth.continueWithGoogle') }}
    </button>

    <button
      type="button"
      class="mt-3 w-full cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="!email.trim()"
      @click="onResetPassword"
    >
      {{ t('auth.forgotPassword') }}
    </button>

    <p
      v-if="errorMessage"
      class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="resetInfoMessage"
      class="mt-3 rounded-lg border border-emerald-700/50 bg-emerald-950/40 p-2 text-xs text-emerald-200"
    >
      {{ resetInfoMessage }}
    </p>
  </section>
</template>
