<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppNotifications from './components/AppNotifications.vue'
import ConfirmModal from './components/ConfirmModal.vue'
import { setAppLocale } from './i18n'
import { exportUserData } from './services/accountService'
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
import { logAppEvent } from './services/observabilityService'
import type { AppLocale } from './types/i18n'
import { useAuthStore } from './stores/auth'
import { useNotificationsStore } from './stores/notifications'

const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
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
const showDeleteAccountConfirm = ref(false)
const exportingData = ref(false)
const deletingAccount = ref(false)
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const pendingSyncCount = ref(getOfflineQueueCount())
const conflictSyncCount = ref(getOfflineConflictCount())
const retryableConflictCount = ref(getRetryableOfflineConflictCount())
const latestConflictLabel = ref<string | null>(null)
const latestConflictReason = ref<string | null>(null)
const latestConflictStatus = ref<'open' | 'retrying' | null>(null)
let removeQueueListener: (() => void) | null = null
let removeWindowErrorListener: (() => void) | null = null
let removeWindowRejectionListener: (() => void) | null = null

const showSyncBanner = computed(
  () => !isOnline.value || pendingSyncCount.value > 0 || conflictSyncCount.value > 0,
)
const currentYear = computed(() => new Date().getFullYear())
const appVersion = computed(() => import.meta.env.VITE_APP_VERSION || 'v0.0.0')
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
  await router.replace({ name: 'login' })
}

function onOpenDeleteAccountConfirm() {
  showDeleteAccountConfirm.value = true
}

function onCancelDeleteAccountConfirm() {
  showDeleteAccountConfirm.value = false
}

async function onExportMyData() {
  const uid = authStore.user?.uid
  if (!uid || exportingData.value) return
  exportingData.value = true
  try {
    const payload = await exportUserData(uid)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `bookmemory-export-${date}.json`
    link.click()
    URL.revokeObjectURL(url)
    notificationsStore.success(t('notifications.accountExportReady'))
  } catch {
    notificationsStore.error(t('notifications.accountExportError'))
  } finally {
    exportingData.value = false
  }
}

async function onConfirmDeleteAccount() {
  if (deletingAccount.value) return
  deletingAccount.value = true
  const deleted = await authStore.deleteAccount()
  deletingAccount.value = false
  if (!deleted) {
    notificationsStore.error(authStore.errorMessage ?? t('authErrors.deleteAccountFailed'))
    return
  }
  showDeleteAccountConfirm.value = false
  notificationsStore.success(t('notifications.accountDeleted'))
  await router.replace({ name: 'login' })
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

function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return
  const onWindowError = (event: ErrorEvent) => {
    const uid = authStore.user?.uid
    if (!uid) return
    const message = event.message || 'unknown_window_error'
    const stack = event.error instanceof Error ? event.error.stack ?? null : null
    void logAppEvent(uid, {
      kind: 'error',
      message,
      stack,
      path: route.fullPath ?? null,
    })
  }
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const uid = authStore.user?.uid
    if (!uid) return
    const reason = event.reason
    const message =
      typeof reason === 'string'
        ? reason
        : reason instanceof Error
          ? reason.message
          : 'unhandled_rejection'
    const stack = reason instanceof Error ? reason.stack ?? null : null
    void logAppEvent(uid, {
      kind: 'unhandledrejection',
      message,
      stack,
      path: route.fullPath ?? null,
    })
  }
  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  removeWindowErrorListener = () => window.removeEventListener('error', onWindowError)
  removeWindowRejectionListener = () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
}

onMounted(() => {
  refreshSyncStatus()
  installGlobalErrorHandlers()
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
  if (removeWindowErrorListener) removeWindowErrorListener()
  if (removeWindowRejectionListener) removeWindowRejectionListener()
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-950 text-slate-100">
    <AppNotifications />
    <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div
        v-if="showUserControls"
        class="mb-3 flex flex-wrap items-center justify-end gap-2"
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
          type="button"
          class="cursor-pointer rounded-xl border border-cyan-500/60 px-2.5 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60 sm:px-3"
          :disabled="exportingData"
          :aria-label="t('home.exportDataAria')"
          :title="t('home.exportDataAria')"
          @click="onExportMyData"
        >
          <span class="sm:hidden">
            <svg
              v-if="exportingData"
              class="h-4 w-4 animate-pulse"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            <svg
              v-else
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </span>
          <span class="hidden sm:inline">
            {{ exportingData ? t('home.exportingData') : t('home.exportData') }}
          </span>
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl border border-rose-500/60 px-2.5 py-2 text-sm text-rose-200 transition hover:bg-rose-500/10 sm:px-3"
          :aria-label="t('home.deleteAccountAria')"
          :title="t('home.deleteAccountAria')"
          @click="onOpenDeleteAccountConfirm"
        >
          <span class="sm:hidden">
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </span>
          <span class="hidden sm:inline">{{ t('home.deleteAccount') }}</span>
        </button>
        <button
          class="cursor-pointer rounded-xl border border-orange-500/60 px-2.5 py-2 text-sm text-orange-200 transition hover:bg-orange-500/10 sm:px-3"
          :aria-label="t('home.signOutAria')"
          :title="t('home.signOutAria')"
          @click="onOpenLogoutConfirm"
        >
          <span class="sm:hidden">
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          <span class="hidden sm:inline">{{ t('home.signOut') }}</span>
        </button>
      </div>

      <nav
        v-if="showSectionNav"
        class="mb-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-2 sm:grid sm:grid-cols-5 sm:overflow-visible"
      >
        <RouterLink
          to="/"
          class="min-w-[92px] shrink-0 cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition sm:min-w-0"
          :class="route.name === 'home' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.home') }}
        </RouterLink>
        <RouterLink
          to="/books"
          class="min-w-[92px] shrink-0 cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition sm:min-w-0"
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
          class="min-w-[92px] shrink-0 cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition sm:min-w-0"
          :class="route.name === 'reading' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.reading') }}
        </RouterLink>
        <RouterLink
          to="/stats"
          class="min-w-[92px] shrink-0 cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition sm:min-w-0"
          :class="route.name === 'stats' ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'"
        >
          {{ t('home.stats') }}
        </RouterLink>
        <RouterLink
          to="/sync"
          class="min-w-[92px] shrink-0 cursor-pointer rounded-xl px-3 py-2 text-center text-sm font-medium transition sm:min-w-0"
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
    <footer class="border-t border-slate-800 bg-slate-950/70">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 overflow-x-auto px-4 py-4 text-xs text-slate-400 whitespace-nowrap sm:px-6 lg:px-8">
        <p>
          © {{ currentYear }} BookMemory. Designed &amp; Developed by
          <a
            href="https://cris-dev.com"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-1 text-cyan-300 underline decoration-cyan-500/50 underline-offset-2 transition hover:text-cyan-200"
          >
            cris-dev
          </a>.
          All rights reserved.
        </p>
        <p>{{ appVersion }}</p>
      </div>
    </footer>

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
    <ConfirmModal
      :open="showDeleteAccountConfirm"
      :title="t('home.deleteAccountConfirmTitle')"
      :message="t('home.deleteAccountConfirmMessage')"
      :confirm-label="deletingAccount ? t('home.deletingAccount') : t('home.deleteAccount')"
      :cancel-label="t('common.cancel')"
      :loading="deletingAccount"
      danger
      @cancel="onCancelDeleteAccountConfirm"
      @confirm="onConfirmDeleteAccount"
    />
  </div>
</template>
