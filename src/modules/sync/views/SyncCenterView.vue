<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getOfflineConflictCount,
  getOfflineConflicts,
  getOfflineQueueCount,
  getOfflineQueueItems,
  onOfflineQueueChange,
  removeOfflineConflict,
  removeOfflineQueueItem,
  requeueOfflineConflictById,
  replayOfflineQueue,
} from '../../../services/offlineQueueService'
import type { OfflineConflictItem, OfflineQueueItem, QueuedFinishSessionPayload } from '../../../types/offline-queue'

const { t } = useI18n()
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const queueItems = ref<OfflineQueueItem[]>([])
const conflicts = ref<OfflineConflictItem[]>([])
const lastAttempt = ref<Date | null>(null)
const lastSuccess = ref<Date | null>(null)
let removeQueueListener: (() => void) | null = null

const pendingCount = computed(() => getOfflineQueueCount())
const conflictCount = computed(() => getOfflineConflictCount())

function formatDate(value: string | Date | null): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString()
}

function refresh() {
  isOnline.value = typeof navigator === 'undefined' ? true : navigator.onLine
  queueItems.value = getOfflineQueueItems()
  conflicts.value = getOfflineConflicts()
}

async function onRetryAll() {
  lastAttempt.value = new Date()
  await replayOfflineQueue()
  if (getOfflineQueueCount() === 0) {
    lastSuccess.value = new Date()
  }
  refresh()
}

function onDiscardQueueItem(id: string) {
  removeOfflineQueueItem(id)
  refresh()
}

async function onRetryConflict(id: string) {
  requeueOfflineConflictById(id, true)
  await onRetryAll()
}

function onDiscardConflict(id: string) {
  removeOfflineConflict(id)
  refresh()
}

function describeQueueItem(item: OfflineQueueItem): string {
  if (item.action === 'finish_reading_session' && item.payload) {
    const payload = item.payload as QueuedFinishSessionPayload
    return `${payload.bookId} · ${payload.startPage}→${payload.endPage}`
  }
  if (item.action === 'save_reading_state') return 'reading_state'
  if (item.action === 'clear_reading_state') return 'reading_state_clear'
  return item.action
}

onMounted(() => {
  refresh()
  if (typeof window !== 'undefined') {
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    removeQueueListener = onOfflineQueueChange(refresh)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', refresh)
    window.removeEventListener('offline', refresh)
  }
  if (removeQueueListener) removeQueueListener()
})
</script>

<template>
  <section class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">
        {{ t('modules.syncLabel') }}
      </p>
      <h1 class="mt-2 text-2xl font-semibold text-white">
        {{ t('sync.title') }}
      </h1>
      <p class="mt-2 text-sm text-slate-300">
        {{ t('sync.subtitle') }}
      </p>

      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.online') }}</p>
          <p class="mt-1 text-lg font-semibold" :class="isOnline ? 'text-emerald-300' : 'text-amber-300'">
            {{ isOnline ? t('sync.online') : t('sync.offline') }}
          </p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.queueTitle') }}</p>
          <p class="mt-1 text-lg font-semibold text-white">{{ pendingCount }}</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.conflictsTitle') }}</p>
          <p class="mt-1 text-lg font-semibold text-rose-300">{{ conflictCount }}</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.lastSuccess') }}</p>
          <p class="mt-1 text-xs text-slate-300">{{ formatDate(lastSuccess) }}</p>
          <p class="mt-1 text-[11px] text-slate-400">{{ t('sync.lastAttempt') }}: {{ formatDate(lastAttempt) }}</p>
        </article>
      </div>

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-cyan-500/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
          @click="onRetryAll"
        >
          {{ t('sync.retryAll') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
          @click="refresh"
        >
          {{ t('sync.refresh') }}
        </button>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <h2 class="text-lg font-semibold text-white">{{ t('sync.queueTitle') }}</h2>
      <p v-if="queueItems.length === 0" class="mt-2 text-sm text-slate-400">{{ t('sync.emptyQueue') }}</p>
      <ul v-else class="mt-3 space-y-2">
        <li
          v-for="item in queueItems"
          :key="item.id"
          class="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
        >
          <p class="text-xs text-slate-300">
            {{ t('sync.action') }}: <span class="font-semibold text-white">{{ item.action }}</span>
          </p>
          <p class="text-xs text-slate-400">{{ describeQueueItem(item) }}</p>
          <p class="text-xs text-slate-400">{{ t('sync.createdAt') }}: {{ formatDate(item.createdAt) }}</p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-md border border-cyan-500/60 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/10"
              @click="onRetryAll"
            >
              {{ t('sync.retryNow') }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-md border border-rose-500/60 px-2 py-1 text-[11px] text-rose-200 transition hover:bg-rose-500/10"
              @click="onDiscardQueueItem(item.id)"
            >
              {{ t('sync.discard') }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <h2 class="text-lg font-semibold text-white">{{ t('sync.conflictsTitle') }}</h2>
      <p v-if="conflicts.length === 0" class="mt-2 text-sm text-slate-400">{{ t('sync.emptyConflicts') }}</p>
      <ul v-else class="mt-3 space-y-2">
        <li
          v-for="item in conflicts"
          :key="item.id"
          class="rounded-lg border border-rose-700/40 bg-rose-950/20 p-3"
        >
          <p class="text-xs text-rose-200">
            {{ t('sync.action') }}: <span class="font-semibold">{{ item.action }}</span>
          </p>
          <p class="text-xs text-rose-200">{{ t('sync.reason') }}: {{ item.errorMessage }}</p>
          <p class="text-xs text-rose-300/90">{{ t('sync.retries') }}: {{ item.retryCount }}</p>
          <p class="text-xs text-rose-300/90">{{ t('sync.failedAt') }}: {{ formatDate(item.failedAt) }}</p>
          <p class="text-xs text-rose-300/90">{{ t('sync.nextRetryAt') }}: {{ formatDate(item.nextRetryAt) }}</p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-md border border-cyan-500/60 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/10"
              @click="onRetryConflict(item.id)"
            >
              {{ t('sync.retryForced') }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-md border border-rose-500/60 px-2 py-1 text-[11px] text-rose-200 transition hover:bg-rose-500/10"
              @click="onDiscardConflict(item.id)"
            >
              {{ t('sync.discard') }}
            </button>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>

