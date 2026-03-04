<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppNotifications from './components/AppNotifications.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import { setAppLocale } from './i18n'
import {
  clearOfflineConflicts,
  getOfflineConflicts,
  getOfflineConflictCount,
  getRetryableOfflineConflictCount,
  getOfflineQueueCount,
  onOfflineQueueChange,
  requeueOfflineConflicts,
  replayOfflineQueue,
} from './services/offlineQueueService'
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
const showLogoutConfirm = ref(false)
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const pendingSyncCount = ref(getOfflineQueueCount())
const conflictSyncCount = ref(getOfflineConflictCount())
const retryableConflictCount = ref(getRetryableOfflineConflictCount())
const latestConflictLabel = ref<string | null>(null)
const latestConflictReason = ref<string | null>(null)
const latestConflictStatus = ref<'open' | 'retrying' | null>(null)
let removeQueueListener: (() => void) | null = null

const showSyncBanner = computed(
  () => !isOnline.value || pendingSyncCount.value > 0 || conflictSyncCount.value > 0,
)
const syncMessage = computed(() => {
  if (conflictSyncCount.value > 0) {
    return t('common.syncConflict', { count: conflictSyncCount.value })
  }
  if (!isOnline.value) {
    return t('common.syncOffline', { count: pendingSyncCount.value })
  }
  if (pendingSyncCount.value > 0) {
    return t('common.syncPending', { count: pendingSyncCount.value })
  }
  return t('common.syncOk')
})

function onChangeLocale(next: AppLocale) {
  setAppLocale(next)
}

function onOpenLogoutConfirm() {
  showLogoutConfirm.value = true
}

function onCancelLogoutConfirm() {
  showLogoutConfirm.value = false
}

async function onConfirmLogout() {
  await authStore.logout()
  showLogoutConfirm.value = false
  await router.push({ name: 'login' })
}

function refreshSyncStatus() {
  isOnline.value = typeof navigator === 'undefined' ? true : navigator.onLine
  pendingSyncCount.value = getOfflineQueueCount()
  conflictSyncCount.value = getOfflineConflictCount()
  retryableConflictCount.value = getRetryableOfflineConflictCount()
  const conflicts = getOfflineConflicts()
  const latest = conflicts[conflicts.length - 1]
  latestConflictLabel.value = latest ? `${latest.action} · ${latest.uid}` : null
  latestConflictReason.value = latest?.errorMessage ?? null
  latestConflictStatus.value = latest?.status ?? null
}

async function onRetrySync() {
  await replayOfflineQueue()
  refreshSyncStatus()
}

function onClearConflicts() {
  clearOfflineConflicts()
  refreshSyncStatus()
}

async function onRetryConflicts() {
  requeueOfflineConflicts()
  await replayOfflineQueue()
  refreshSyncStatus()
}

onMounted(() => {
  refreshSyncStatus()
  if (typeof window !== 'undefined') {
    window.addEventListener('online', refreshSyncStatus)
    window.addEventListener('offline', refreshSyncStatus)
    removeQueueListener = onOfflineQueueChange(refreshSyncStatus)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', refreshSyncStatus)
    window.removeEventListener('offline', refreshSyncStatus)
  }
  if (removeQueueListener) removeQueueListener()
})
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <AppNotifications />
    <main class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div
        v-if="showUserControls"
        class="mb-3 flex items-center justify-end gap-2"
      >
        <span class="text-xs uppercase tracking-wide text-slate-400">{{ t('common.language') }}</span>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
          @click="onChangeLocale(nextLocale)"
        >
          {{ nextLocaleLabel }}
        </button>
        <button
          class="cursor-pointer rounded-xl border border-orange-500/60 px-3 py-2 text-sm text-orange-200 transition hover:bg-orange-500/10"
          @click="onOpenLogoutConfirm"
        >
          {{ t('home.signOut') }}
        </button>
      </div>

      <nav
        v-if="showSectionNav"
        class="mb-4 grid grid-cols-5 gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-2"
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
        <RouterLink
          to="/sync"
          class="cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition"
          :class="route.name === 'sync' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.sync') }}
        </RouterLink>
      </nav>

      <section
        v-if="showSyncBanner"
        class="mb-4 flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between"
        :class="
          conflictSyncCount > 0
            ? 'border border-rose-500/40 bg-rose-950/30'
            : 'border border-amber-500/40 bg-amber-950/30'
        "
      >
        <p
          class="text-xs"
          :class="conflictSyncCount > 0 ? 'text-rose-200' : 'text-amber-200'"
        >
          {{ syncMessage }}
          <span
            v-if="conflictSyncCount > 0 && latestConflictLabel"
            class="ml-1 text-[11px] text-rose-300/90"
          >
            {{ t('common.syncLatestConflict', { label: latestConflictLabel }) }}
          </span>
          <span
            v-if="conflictSyncCount > 0 && latestConflictReason"
            class="ml-1 text-[11px] text-rose-300/90"
          >
            {{ t('common.syncLatestReason', { reason: latestConflictReason }) }}
          </span>
          <span
            v-if="conflictSyncCount > 0 && latestConflictStatus === 'retrying'"
            class="ml-1 text-[11px] text-rose-300/90"
          >
            {{ t('common.syncRetrying') }}
          </span>
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-amber-500/60 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!isOnline || pendingSyncCount === 0"
            @click="onRetrySync"
          >
            {{ t('common.syncRetry') }}
          </button>
          <button
            v-if="conflictSyncCount > 0"
            type="button"
            class="cursor-pointer rounded-lg border border-rose-500/60 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
            :disabled="retryableConflictCount === 0"
            @click="onRetryConflicts"
          >
            {{ t('common.syncRetryConflicts', { count: retryableConflictCount }) }}
          </button>
          <button
            v-if="conflictSyncCount > 0"
            type="button"
            class="cursor-pointer rounded-lg border border-rose-500/60 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/20"
            @click="onClearConflicts"
          >
            {{ t('common.syncClearConflicts') }}
          </button>
        </div>
      </section>
      <RouterView />
    </main>

    <ConfirmModal
      :open="showLogoutConfirm"
      :title="t('home.signOutConfirmTitle')"
      :message="t('home.signOutConfirmMessage')"
      :confirm-label="t('home.signOut')"
      :cancel-label="t('common.cancel')"
      danger
      @cancel="onCancelLogoutConfirm"
      @confirm="onConfirmLogout"
    />
  </div>
</template>
