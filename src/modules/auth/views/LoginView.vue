<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../../stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const { errorMessage, isAuthenticated, initializing } = storeToRefs(authStore)
const email = ref('')
const password = ref('')
const mode = ref<'login' | 'register'>('login')

async function onEmailSubmit() {
  if (mode.value === 'login') {
    await authStore.loginWithEmail(email.value, password.value)
  } else {
    await authStore.registerWithEmail(email.value, password.value)
  }

  if (isAuthenticated.value) {
    const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirectTarget)
  }
}

async function onGoogleSubmit() {
  await authStore.loginWithGoogle()

  if (isAuthenticated.value) {
    const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirectTarget)
  }
}
</script>

<template>
  <section class="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">Authentication</p>
    <h1 class="mt-2 text-2xl font-semibold text-white">Welcome to Book Memory</h1>
    <p class="mt-2 text-sm text-slate-300">Sign in to track your books, sessions, and streaks.</p>

    <form class="mt-6 space-y-3" @submit.prevent="onEmailSubmit">
      <label class="block">
        <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Email</span>
        <input
          v-model="email"
          type="email"
          required
          autocomplete="email"
          class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2"
        />
      </label>

      <label class="block">
        <span class="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Password</span>
        <input
          v-model="password"
          type="password"
          required
          minlength="6"
          autocomplete="current-password"
          class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2"
        />
      </label>

      <div class="flex gap-2">
        <button
          type="submit"
          class="flex-1 cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          {{ mode === 'login' ? 'Sign in with email' : 'Create account' }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          @click="mode = mode === 'login' ? 'register' : 'login'"
        >
          {{ mode === 'login' ? 'Register' : 'Login' }}
        </button>
      </div>
    </form>

    <button
      type="button"
      class="mt-3 w-full cursor-pointer rounded-xl border border-emerald-500/60 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
      :disabled="initializing"
      @click="onGoogleSubmit"
    >
      Continue with Google
    </button>

    <p v-if="errorMessage" class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200">
      {{ errorMessage }}
    </p>
  </section>
</template>
