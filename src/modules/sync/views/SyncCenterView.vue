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
const showTechnicalDetails = ref(false)
let removeQueueListener: (() => void) | null = null

const pendingCount = computed(() => getOfflineQueueCount())
const conflictCount = computed(() => getOfflineConflictCount())
const hasConflicts = computed(() => conflictCount.value > 0)
const hasPending = computed(() => pendingCount.value > 0)

type SyncCategory = 'sessions' | 'books' | 'favorites' | 'reading_state' | 'other'

interface GroupedSyncItems<T> {
  key: SyncCategory
  label: string
  items: T[]
}

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

async function onKeepThisDeviceVersion(id: string) {
  requeueOfflineConflictById(id, true)
  await onRetryAll()
}

function onUseCloudVersion(id: string) {
  removeOfflineConflict(id)
  refresh()
}

function mapActionToCategory(action: OfflineQueueItem['action']): SyncCategory {
  if (action === 'finish_reading_session') return 'sessions'
  if (action === 'library_update_favorite') return 'favorites'
  if (action === 'library_add_book' || action === 'library_update_metadata' || action === 'library_delete_book') {
    return 'books'
  }
  if (action === 'save_reading_state' || action === 'clear_reading_state') return 'reading_state'
  return 'other'
}

function categoryLabel(category: SyncCategory): string {
  if (category === 'sessions') return t('sync.groupSessions')
  if (category === 'books') return t('sync.groupBooks')
  if (category === 'favorites') return t('sync.groupFavorites')
  if (category === 'reading_state') return t('sync.groupReadingState')
  return t('sync.groupOther')
}

function describeQueueItem(item: OfflineQueueItem): string {
  if (item.action === 'finish_reading_session' && item.payload) {
    const payload = item.payload as QueuedFinishSessionPayload
    return `${t('sync.sessionPages')}: ${payload.startPage}→${payload.endPage}`
  }
  if (item.action === 'save_reading_state') return t('sync.readingStateSaved')
  if (item.action === 'clear_reading_state') return t('sync.readingStateCleared')
  if (item.action === 'library_add_book') return t('sync.bookAdded')
  if (item.action === 'library_update_favorite') return t('sync.favoriteUpdated')
  if (item.action === 'library_update_metadata') return t('sync.bookUpdated')
  if (item.action === 'library_delete_book') return t('sync.bookRemoved')
  return t('sync.unknownChange')
}

function buildGroups<T extends OfflineQueueItem | OfflineConflictItem>(items: T[]): GroupedSyncItems<T>[] {
  const map = new Map<SyncCategory, T[]>()
  items.forEach((item) => {
    const key = mapActionToCategory(item.action)
    const current = map.get(key) ?? []
    current.push(item)
    map.set(key, current)
  })
  return Array.from(map.entries()).map(([key, groupedItems]) => ({
    key,
    label: categoryLabel(key),
    items: groupedItems,
  }))
}

const groupedQueueItems = computed(() => buildGroups(queueItems.value))
const groupedConflicts = computed(() => buildGroups(conflicts.value))

const statusToneClass = computed(() => {
  if (hasConflicts.value) return 'border-rose-500/50 bg-rose-950/25 text-rose-100'
  if (hasPending.value || !isOnline.value) return 'border-amber-500/50 bg-amber-950/20 text-amber-100'
  return 'border-emerald-500/50 bg-emerald-950/20 text-emerald-100'
})

const statusTitle = computed(() => {
  if (hasConflicts.value) return t('sync.statusConflictTitle')
  if (!isOnline.value) return t('sync.statusOfflineTitle')
  if (hasPending.value) return t('sync.statusPendingTitle')
  return t('sync.statusOkTitle')
})

const statusDescription = computed(() => {
  if (hasConflicts.value) return t('sync.statusConflictBody', { count: conflictCount.value })
  if (!isOnline.value) return t('sync.statusOfflineBody', { count: pendingCount.value })
  if (hasPending.value) return t('sync.statusPendingBody', { count: pendingCount.value })
  return t('sync.statusOkBody')
})

const primaryActionLabel = computed(() => {
  if (hasConflicts.value) return t('sync.primaryActionReviewNow')
  if (hasPending.value && isOnline.value) return t('sync.primaryActionSyncNow')
  return t('sync.primaryActionRefresh')
})

const isPrimaryActionDisabled = computed(() => hasPending.value && !isOnline.value && !hasConflicts.value)

async function onPrimaryAction() {
  if (hasConflicts.value) {
    await onRetryAll()
    return
  }
  if (hasPending.value && isOnline.value) {
    await onRetryAll()
    return
  }
  refresh()
}

function toggleDetails() {
  showTechnicalDetails.value = !showTechnicalDetails.value
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

      <article class="mt-4 rounded-xl border p-4" :class="statusToneClass">
        <p class="text-sm font-semibold">
          {{ statusTitle }}
        </p>
        <p class="mt-1 text-sm opacity-90">
          {{ statusDescription }}
        </p>
      </article>

      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.connectionLabel') }}</p>
          <p class="mt-1 text-lg font-semibold" :class="isOnline ? 'text-emerald-300' : 'text-amber-300'">
            {{ isOnline ? t('sync.online') : t('sync.offline') }}
          </p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.pendingLabel') }}</p>
          <p class="mt-1 text-lg font-semibold text-white">{{ pendingCount }}</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.conflictsLabel') }}</p>
          <p class="mt-1 text-lg font-semibold text-rose-300">{{ conflictCount }}</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('sync.updatedLabel') }}</p>
          <p class="mt-1 text-xs text-slate-300">{{ formatDate(lastSuccess) }}</p>
          <p class="mt-1 text-[11px] text-slate-400">{{ t('sync.lastAttempt') }}: {{ formatDate(lastAttempt) }}</p>
        </article>
      </div>

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-cyan-500/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
          :disabled="isPrimaryActionDisabled"
          @click="onPrimaryAction"
        >
          {{ primaryActionLabel }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
          @click="toggleDetails"
        >
          {{ showTechnicalDetails ? t('sync.hideDetails') : t('sync.showDetails') }}
        </button>
      </div>

      <p class="mt-2 text-xs text-slate-400">
        {{ isOnline ? t('sync.autoSyncHint') : t('sync.offlineHint') }}
      </p>
    </section>

    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <h2 class="text-lg font-semibold text-white">{{ t('sync.queueTitle') }}</h2>
      <p v-if="queueItems.length === 0" class="mt-2 text-sm text-slate-400">{{ t('sync.emptyQueue') }}</p>
      <div v-else class="mt-3 space-y-4">
        <section
          v-for="group in groupedQueueItems"
          :key="`queue-${group.key}`"
          class="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
        >
          <p class="text-sm font-semibold text-slate-100">{{ group.label }} ({{ group.items.length }})</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
            >
              <p class="text-sm text-slate-200">{{ describeQueueItem(item) }}</p>
              <p class="mt-1 text-xs text-slate-400">{{ t('sync.createdAt') }}: {{ formatDate(item.createdAt) }}</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="cursor-pointer rounded-md border border-cyan-500/60 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/10"
                  :disabled="!isOnline"
                  @click="onRetryAll"
                >
                  {{ t('sync.actionSyncNow') }}
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-md border border-rose-500/60 px-2 py-1 text-[11px] text-rose-200 transition hover:bg-rose-500/10"
                  @click="onDiscardQueueItem(item.id)"
                >
                  {{ t('sync.actionRemove') }}
                </button>
              </div>

              <div v-if="showTechnicalDetails" class="mt-2 rounded-md border border-slate-800 bg-slate-900/60 p-2">
                <p class="text-[11px] text-slate-400">{{ t('sync.techAction') }}: {{ item.action }}</p>
                <p class="text-[11px] text-slate-400">{{ t('sync.techId') }}: {{ item.id }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <h2 class="text-lg font-semibold text-white">{{ t('sync.conflictsTitle') }}</h2>
      <p v-if="conflicts.length === 0" class="mt-2 text-sm text-slate-400">{{ t('sync.emptyConflicts') }}</p>
      <div v-else class="mt-3 space-y-4">
        <section
          v-for="group in groupedConflicts"
          :key="`conflict-${group.key}`"
          class="rounded-xl border border-rose-700/30 bg-rose-950/15 p-3"
        >
          <p class="text-sm font-semibold text-rose-100">{{ group.label }} ({{ group.items.length }})</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="rounded-lg border border-rose-700/30 bg-rose-950/20 p-3"
            >
              <p class="text-sm text-rose-100">{{ describeQueueItem(item) }}</p>
              <p class="mt-1 text-xs text-rose-200">{{ t('sync.conflictGuide') }}</p>
              <p class="mt-1 text-xs text-rose-300/90">{{ t('sync.whatHappened') }}: {{ item.errorMessage }}</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="cursor-pointer rounded-md border border-cyan-500/60 px-2 py-1 text-[11px] text-cyan-200 transition hover:bg-cyan-500/10"
                  @click="onKeepThisDeviceVersion(item.id)"
                >
                  {{ t('sync.keepDeviceVersion') }}
                </button>
                <button
                  type="button"
                  class="cursor-pointer rounded-md border border-rose-500/60 px-2 py-1 text-[11px] text-rose-200 transition hover:bg-rose-500/10"
                  @click="onUseCloudVersion(item.id)"
                >
                  {{ t('sync.useCloudVersion') }}
                </button>
              </div>

              <div v-if="showTechnicalDetails" class="mt-2 rounded-md border border-rose-700/30 bg-rose-950/25 p-2">
                <p class="text-[11px] text-rose-300">{{ t('sync.techRetries') }}: {{ item.retryCount }}</p>
                <p class="text-[11px] text-rose-300">{{ t('sync.techFailedAt') }}: {{ formatDate(item.failedAt) }}</p>
                <p class="text-[11px] text-rose-300">{{ t('sync.techNextRetryAt') }}: {{ formatDate(item.nextRetryAt) }}</p>
                <p class="text-[11px] text-rose-300">{{ t('sync.techId') }}: {{ item.id }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </section>
  </section>
</template>
