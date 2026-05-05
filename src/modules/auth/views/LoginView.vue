<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { BookOpen, Globe2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '../../../components/ui/ThemeToggle.vue'
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
const floatingBooks = [
  { id: 1, imageSrc: '/auth-books/book-01.webp', color: 'var(--app-primary)', left: '5%', delay: '-0.4s', duration: '11.4s', size: '3.5rem', rotate: '-15deg', z: 2, depth: '0.86' },
  { id: 2, imageSrc: '/auth-books/book-02.webp', color: 'var(--app-secondary)', left: '23%', delay: '-5.1s', duration: '12.8s', size: '5rem', rotate: '9deg', z: 6, depth: '1.05' },
  { id: 3, imageSrc: '/auth-books/book-03.webp', color: 'var(--app-accent)', left: '35%', delay: '-2.2s', duration: '10.7s', size: '3.2rem', rotate: '-4deg', z: 1, depth: '0.78' },
  { id: 4, imageSrc: '/auth-books/book-04.webp', color: 'var(--app-primary-strong)', left: '58%', delay: '-8.9s', duration: '13.3s', size: '4.6rem', rotate: '16deg', z: 5, depth: '1' },
  { id: 5, imageSrc: '/auth-books/book-05.webp', color: 'var(--app-secondary-strong)', left: '76%', delay: '-3.7s', duration: '11.9s', size: '3.9rem', rotate: '-18deg', z: 4, depth: '0.95' },
  { id: 6, imageSrc: '/auth-books/book-06.webp', color: 'var(--app-accent-strong)', left: '88%', delay: '-10.6s', duration: '12.4s', size: '3rem', rotate: '6deg', z: 2, depth: '0.82' },
  { id: 7, imageSrc: '/auth-books/book-07.webp', color: 'var(--app-primary)', left: '12%', delay: '-7.3s', duration: '13.7s', size: '4.2rem', rotate: '13deg', z: 5, depth: '0.98' },
  { id: 8, imageSrc: '/auth-books/book-08.webp', color: 'var(--app-secondary)', left: '29%', delay: '-1.5s', duration: '11.1s', size: '4.4rem', rotate: '-11deg', z: 7, depth: '1.08' },
  { id: 9, imageSrc: '/auth-books/book-09.webp', color: 'var(--app-accent)', left: '51%', delay: '-9.8s', duration: '12.1s', size: '3.4rem', rotate: '7deg', z: 3, depth: '0.88' },
  { id: 10, imageSrc: '/auth-books/book-10.webp', color: 'var(--app-primary-strong)', left: '66%', delay: '-4.4s', duration: '10.9s', size: '4.9rem', rotate: '-13deg', z: 8, depth: '1.12' },
  { id: 11, imageSrc: '/auth-books/book-11.webp', color: 'var(--app-secondary-strong)', left: '81%', delay: '-6.2s', duration: '13s', size: '3.6rem', rotate: '18deg', z: 3, depth: '0.9' },
  { id: 12, imageSrc: '/auth-books/book-06.webp', color: 'var(--app-accent-strong)', left: '93%', delay: '-11.4s', duration: '11.6s', size: '3.3rem', rotate: '-7deg', z: 1, depth: '0.8' },
]
const modeSubtitle = computed(() =>
  mode.value === 'login' ? t('auth.subtitleLogin') : t('auth.subtitleRegister'),
)
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
    resetInfoMessage.value = t('auth.passwordResetNeedsEmail')
    return
  }
  const sent = await authStore.sendPasswordReset(email.value.trim())
  if (sent) {
    resetInfoMessage.value = t('auth.passwordResetSent')
  }
}

function onToggleMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  resetInfoMessage.value = null
  authStore.clearError()
}
</script>

<template>
  <section class="mx-auto grid max-w-5xl items-center gap-6 py-4 md:grid-cols-[1.05fr_0.95fr]">
    <div class="bm-page-header relative min-h-128 flex-col items-stretch! justify-between overflow-hidden p-5">
      <div
        class="relative isolate min-h-70 w-full overflow-hidden rounded-2xl bg-(--app-surface-muted) max-[640px]:min-h-48"
        aria-hidden="true"
      >
        <span class="absolute inset-[1.5rem_16%_auto] h-px bg-[color-mix(in_srgb,var(--app-border)_76%,transparent)] opacity-[0.72]" />
        <span class="absolute inset-[auto_8%_2.2rem] h-px bg-[color-mix(in_srgb,var(--app-border)_76%,transparent)] opacity-[0.72]" />
        <span
          v-for="book in floatingBooks"
          :key="book.id"
          class="login-floating-book absolute -bottom-20 left-(--book-left) z-(--book-z) h-[calc(var(--book-size)*1.28)] w-(--book-size) opacity-(--book-depth) drop-shadow-[0_calc(0.6rem*var(--book-depth))_calc(1rem*var(--book-depth))_rgba(15,23,42,0.18)] will-change-[transform,opacity] motion-reduce:opacity-90 max-[640px]:h-[calc(var(--book-size)*1.05)] max-[640px]:w-[calc(var(--book-size)*0.82)]"
          :style="{
            '--book-color': book.color,
            '--book-image': `url(${book.imageSrc})`,
            '--book-left': book.left,
            '--book-delay': book.delay,
            '--book-duration': book.duration,
            '--book-size': book.size,
            '--book-rotate': book.rotate,
            '--book-z': book.z,
            '--book-depth': book.depth,
          }"
        >
          <span class="absolute inset-0 border border-[color-mix(in_srgb,var(--book-color)_74%,var(--app-border))] bg-(--book-color) bg-cover bg-center [background-image:var(--book-image)] rounded-[0.42rem_0.72rem_0.72rem_0.42rem]" />
          <span class="absolute inset-[0.42rem_-0.38rem_0.42rem_auto] w-[0.6rem] rounded-[0_0.55rem_0.55rem_0] border border-l-0 border-(--app-border) bg-(--app-surface)" />
        </span>
      </div>

      <div class="relative z-1 pt-5">
        <span class="bm-brand-mark mb-5">
          <BookOpen
            :size="28"
            aria-hidden="true"
          />
        </span>
        <p class="bm-eyebrow">{{ t('auth.section') }}</p>
        <h1 class="bm-title mt-3 max-w-lg">
          {{ t('auth.title') }}
        </h1>
        <p class="bm-muted mt-4 max-w-md text-base">
          {{ modeSubtitle }}
        </p>
      </div>
    </div>

    <div class="bm-panel">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="bm-eyebrow">{{ t('common.bookMemory') }}</p>
          <h2 class="bm-section-title mt-1">
            {{ mode === 'login' ? t('auth.signInWithEmail') : t('auth.createAccount') }}
          </h2>
        </div>
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          class="bm-icon-button"
          :aria-label="nextLocaleLabel"
          :title="nextLocaleLabel"
          @click="onChangeLocale(nextLocale)"
        >
          <Globe2
            :size="18"
            aria-hidden="true"
          />
        </button>
      </div>
    </div>

    <form
      class="mt-6 space-y-3"
      @submit.prevent="onEmailSubmit"
    >
      <label class="block">
        <span class="bm-label mb-1 block">{{ t('auth.email') }}</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="bm-input text-sm"
        >
      </label>

      <label class="block">
        <span class="bm-label mb-1 block">{{ t('auth.password') }}</span>
        <input
          v-model="password"
          type="password"
          required
          minlength="6"
          :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
          class="bm-input text-sm"
        >
      </label>

      <div class="flex gap-2">
        <button
          type="submit"
          class="bm-button bm-button-primary flex-1"
        >
          {{ mode === 'login' ? t('auth.signInWithEmail') : t('auth.createAccount') }}
        </button>
        <button
          type="button"
          class="bm-button"
          @click="onToggleMode"
        >
          {{ mode === 'login' ? t('auth.register') : t('auth.login') }}
        </button>
      </div>
    </form>

    <button
      type="button"
      class="bm-button bm-button-success mt-3 w-full"
      :disabled="initializing"
      @click="onGoogleSubmit"
    >
      {{ t('auth.continueWithGoogle') }}
    </button>

    <button
      v-if="mode === 'login'"
      type="button"
      class="bm-button mt-3 w-full"
      @click="onResetPassword"
    >
      {{ t('auth.forgotPassword') }}
    </button>

    <p
      v-if="errorMessage"
      class="mt-3 rounded-lg border border-(--app-danger) bg-(--app-danger-soft) p-2 text-xs text-(--app-danger)"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="resetInfoMessage"
      class="mt-3 rounded-lg border border-(--app-success) bg-(--app-success-soft) p-2 text-xs text-(--app-success)"
    >
      {{ resetInfoMessage }}
    </p>
    </div>
  </section>
</template>

<style scoped>
.login-floating-book {
  --book-rotate: 0deg;
  --book-duration: 12s;
  --book-delay: 0s;
  --book-depth: 1;

  transform: rotate(var(--book-rotate));
  animation: book-rise var(--book-duration) linear infinite;
  animation-delay: var(--book-delay);
  animation-fill-mode: both;
}

@keyframes book-rise {
  0% {
    transform: translate3d(0, 0, 0) rotate(var(--book-rotate)) scale(calc(var(--book-depth) * 0.88));
    opacity: 0;
  }

  4%,
  92% {
    opacity: 1;
  }

  100% {
    transform: translate3d(0, -24rem, 0) rotate(calc(var(--book-rotate) * -1)) scale(calc(var(--book-depth) * 1.08));
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-floating-book {
    animation: none;
  }
}
</style>
