<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { useAuthStore } from '../stores/auth'

const appStore = useAppStore()
const authStore = useAuthStore()
const router = useRouter()

const { appName, mobileFirst } = storeToRefs(appStore)
const { user } = storeToRefs(authStore)

async function onLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg sm:p-8">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">Book Memory</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">Base setup ready</h1>
          <p class="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Auth guard is active and module routes are scaffolded.
          </p>
        </div>
        <button
          class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
          @click="onLogout"
        >
          Sign out
        </button>
      </div>

      <dl class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-400">App</dt>
          <dd class="mt-1 text-base font-medium text-slate-100">{{ appName }}</dd>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <dt class="text-xs uppercase tracking-wide text-slate-400">UI strategy</dt>
          <dd class="mt-1 text-base font-medium text-emerald-300">
            {{ mobileFirst ? 'Mobile-first enabled' : 'Not configured' }}
          </dd>
        </div>
        <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-slate-400">Signed user</dt>
          <dd class="mt-1 text-sm font-medium text-slate-100">
            {{ user?.email ?? 'Authenticated user without email provider' }}
          </dd>
        </div>
      </dl>
    </section>

    <nav class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/books"
      >
        Books
      </RouterLink>
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/reading"
      >
        Reading
      </RouterLink>
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/stats"
      >
        Stats
      </RouterLink>
      <RouterLink
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
        to="/"
      >
        Home
      </RouterLink>
    </nav>
  </div>
</template>
