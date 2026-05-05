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
  { id: 1, color: '#1f7a5f', accent: '#dceee5', left: '9%', delay: '-0.8s', duration: '7.2s', size: '3.8rem', rotate: '-10deg' },
  { id: 2, color: '#b96b2c', accent: '#f2dfc7', left: '24%', delay: '-3.2s', duration: '8.4s', size: '4.6rem', rotate: '8deg' },
  { id: 3, color: '#155b47', accent: '#fffaf0', left: '43%', delay: '-1.9s', duration: '7.8s', size: '3.4rem', rotate: '-5deg' },
  { id: 4, color: '#6f563d', accent: '#f7e7ba', left: '61%', delay: '-4.8s', duration: '9s', size: '4.2rem', rotate: '12deg' },
  { id: 5, color: '#18734b', accent: '#d9eee2', left: '78%', delay: '-2.6s', duration: '8.8s', size: '3.7rem', rotate: '-14deg' },
  { id: 6, color: '#a16207', accent: '#fffaf0', left: '88%', delay: '-5.7s', duration: '9.6s', size: '3.1rem', rotate: '7deg' },
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
  <section class="mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl items-center gap-6 py-6 md:grid-cols-[1.05fr_0.95fr]">
    <div class="login-hero bm-page-header min-h-[32rem] items-start">
      <div
        class="login-book-animation"
        aria-hidden="true"
      >
        <span class="login-book-lane" />
        <span class="login-book-lane login-book-lane-offset" />
        <span
          v-for="book in floatingBooks"
          :key="book.id"
          class="login-floating-book"
          :style="{
            '--book-color': book.color,
            '--book-accent': book.accent,
            '--book-left': book.left,
            '--book-delay': book.delay,
            '--book-duration': book.duration,
            '--book-size': book.size,
            '--book-rotate': book.rotate,
          }"
        >
          <span class="login-book-cover" />
          <span class="login-book-pages" />
        </span>
      </div>

      <div class="login-hero-copy">
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
      class="mt-3 rounded-lg border border-[var(--app-danger)] bg-[var(--app-danger-soft)] p-2 text-xs text-[var(--app-danger)]"
    >
      {{ errorMessage }}
    </p>

    <p
      v-if="resetInfoMessage"
      class="mt-3 rounded-lg border border-[var(--app-success)] bg-[var(--app-success-soft)] p-2 text-xs text-[var(--app-success)]"
    >
      {{ resetInfoMessage }}
    </p>
    </div>
  </section>
</template>

<style scoped>
.login-hero {
  position: relative;
  overflow: hidden;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
  padding: 1.25rem;
}

.login-book-animation {
  position: relative;
  min-height: 17.5rem;
  overflow: hidden;
  border-radius: 1rem;
  background: var(--app-surface-raised);
  isolation: isolate;
}

.login-book-lane {
  position: absolute;
  inset: 1.5rem 16% auto;
  height: 1px;
  background: color-mix(in srgb, var(--app-border) 76%, transparent);
  opacity: 0.72;
}

.login-book-lane-offset {
  inset: auto 8% 2.2rem;
}

.login-floating-book {
  position: absolute;
  left: var(--book-left);
  bottom: -5.5rem;
  width: var(--book-size);
  height: calc(var(--book-size) * 1.28);
  transform: rotate(var(--book-rotate));
  animation: book-rise var(--book-duration) linear infinite;
  animation-delay: var(--book-delay);
  filter: drop-shadow(0 0.75rem 1rem rgba(71, 52, 30, 0.16));
}

.login-book-cover {
  position: absolute;
  inset: 0;
  border: 1px solid color-mix(in srgb, var(--book-color) 74%, var(--app-border));
  border-radius: 0.42rem 0.72rem 0.72rem 0.42rem;
  background: var(--book-color);
}

.login-book-cover::before {
  content: "";
  position: absolute;
  inset: 0.38rem auto 0.38rem 0.42rem;
  width: 0.34rem;
  border-radius: 999px;
  background: var(--book-accent);
  opacity: 0.9;
}

.login-book-cover::after {
  content: "";
  position: absolute;
  right: 0.55rem;
  bottom: 0.62rem;
  width: 1.25rem;
  height: 0.28rem;
  border-radius: 999px;
  background: var(--book-accent);
  opacity: 0.78;
}

.login-book-pages {
  position: absolute;
  inset: 0.42rem -0.38rem 0.42rem auto;
  width: 0.6rem;
  border: 1px solid var(--app-border);
  border-left: 0;
  border-radius: 0 0.55rem 0.55rem 0;
  background: var(--app-surface);
}

.login-hero-copy {
  position: relative;
  z-index: 1;
  padding-top: 1.25rem;
}

@keyframes book-rise {
  0% {
    transform: translate3d(0, 0, 0) rotate(var(--book-rotate)) scale(0.86);
    opacity: 0;
  }

  12%,
  82% {
    opacity: 1;
  }

  100% {
    transform: translate3d(0, -24rem, 0) rotate(calc(var(--book-rotate) * -1)) scale(1.08);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-floating-book {
    animation: none;
    opacity: 0.9;
  }
}

@media (max-width: 640px) {
  .login-book-animation {
    min-height: 12rem;
  }

  .login-floating-book {
    width: calc(var(--book-size) * 0.82);
    height: calc(var(--book-size) * 1.05);
  }
}
</style>
