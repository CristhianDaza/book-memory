<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { BarChart3, BookOpen, Home, Library, RefreshCw, TimerReset } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppShell from './components/layout/AppShell.vue'
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

const showChrome = computed(() => route.name !== 'login')
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
const syncTone = computed<'success' | 'warning' | 'danger'>(() => {
  if (conflictSyncCount.value > 0) return 'danger'
  if (!isOnline.value || pendingSyncCount.value > 0) return 'warning'
  return 'success'
})
const currentYear = computed(() => new Date().getFullYear())
const appVersion = computed(() => import.meta.env.VITE_APP_VERSION || 'v0.0.0')
const navItems = computed(() => [
  {
    to: '/',
    label: t('home.home'),
    active: route.name === 'home',
    icon: Home,
  },
  {
    to: '/books',
    label: t('home.books'),
    active: route.name === 'books' || route.name === 'book-detail',
    icon: Library,
  },
  {
    to: '/reading',
    label: t('home.reading'),
    active: route.name === 'reading',
    icon: TimerReset,
  },
  {
    to: '/stats',
    label: t('home.stats'),
    active: route.name === 'stats',
    icon: BarChart3,
  },
  {
    to: '/sync',
    label: t('home.sync'),
    active: route.name === 'sync',
    icon: RefreshCw,
  },
])
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
  <AppShell
    :nav-items="navItems"
    :show-chrome="showChrome"
    :sync-visible="showSyncBanner"
    :sync-tone="syncTone"
    :sync-message="syncMessage"
    :next-locale-label="nextLocaleLabel"
    :exporting-data="exportingData"
    :export-label="exportingData ? t('home.exportingData') : t('home.exportData')"
    :export-aria-label="t('home.exportDataAria')"
    :delete-label="t('home.deleteAccount')"
    :sign-out-label="t('home.signOut')"
    :current-year="currentYear"
    :app-version="appVersion"
    @change-locale="onChangeLocale(nextLocale)"
    @export-data="onExportMyData"
    @delete-account="onOpenDeleteAccountConfirm"
    @sign-out="onOpenLogoutConfirm"
  >
    <AppNotifications />
    <section
      v-if="showSyncBanner"
      class="bm-subtle-panel mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex items-start gap-2">
        <BookOpen
          :size="17"
          class="mt-0.5 text-(--app-primary-strong)"
          aria-hidden="true"
        />
        <p
          class="text-xs"
          :class="conflictSyncCount > 0 ? 'text-(--app-danger)' : 'text-(--app-warning)'"
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
      </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="bm-button bm-button-warm text-xs"
            :disabled="!isOnline || pendingSyncCount === 0"
            @click="onRetrySync"
          >
            {{ t('common.syncRetry') }}
          </button>
          <button
            v-if="conflictSyncCount > 0"
            type="button"
            class="bm-button bm-button-danger text-xs"
            :disabled="retryableConflictCount === 0"
            @click="onRetryConflicts"
          >
            {{ t('common.syncRetryConflicts', { count: retryableConflictCount }) }}
          </button>
          <button
            v-if="conflictSyncCount > 0"
            type="button"
            class="bm-button bm-button-danger text-xs"
            @click="onClearConflicts"
          >
            {{ t('common.syncClearConflicts') }}
          </button>
        </div>
      </section>
      <RouterView />

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
  </AppShell>
</template>
