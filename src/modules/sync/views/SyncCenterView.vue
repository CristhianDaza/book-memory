<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
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

type SyncCategory = 'sessions' | 'books' | 'favorites' | 'reading_state' | 'streak' | 'other'

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
  if (action === 'streak_mark_day') return 'streak'
  return 'other'
}

function categoryLabel(category: SyncCategory): string {
  if (category === 'sessions') return t('sync.groupSessions')
  if (category === 'books') return t('sync.groupBooks')
  if (category === 'favorites') return t('sync.groupFavorites')
  if (category === 'reading_state') return t('sync.groupReadingState')
  if (category === 'streak') return t('sync.groupStreak')
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
  if (item.action === 'streak_mark_day') return t('sync.streakUpdated')
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
  if (hasConflicts.value) return 'border-[var(--app-danger)] bg-[var(--app-danger-soft)] text-[var(--app-danger)]'
  if (hasPending.value || !isOnline.value) {
    return 'border-[var(--app-warning)] bg-[var(--app-warning-soft)] text-[var(--app-warning)]'
  }
  return 'border-[var(--app-success)] bg-[var(--app-success-soft)] text-[var(--app-success)]'
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
  <section class="bm-page">
    <PageHeader
      :eyebrow="t('modules.syncLabel')"
      :title="t('sync.title')"
      :subtitle="t('sync.subtitle')"
    />

    <SurfaceCard>
      <article class="rounded-xl border p-4" :class="statusToneClass">
        <p class="text-sm font-semibold">
          {{ statusTitle }}
        </p>
        <p class="mt-1 text-sm opacity-90">
          {{ statusDescription }}
        </p>
      </article>

      <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <article class="bm-stat-card">
          <p class="bm-stat-label">{{ t('sync.connectionLabel') }}</p>
          <p class="mt-1 text-lg font-semibold" :class="isOnline ? 'text-(--app-success)' : 'text-(--app-warning)'">
            {{ isOnline ? t('sync.online') : t('sync.offline') }}
          </p>
        </article>
        <article class="bm-stat-card">
          <p class="bm-stat-label">{{ t('sync.pendingLabel') }}</p>
          <p class="bm-stat-value mt-1">{{ pendingCount }}</p>
        </article>
        <article class="bm-stat-card">
          <p class="bm-stat-label">{{ t('sync.conflictsLabel') }}</p>
          <p class="mt-1 text-lg font-semibold text-(--app-danger)">{{ conflictCount }}</p>
        </article>
        <article class="bm-stat-card">
          <p class="bm-stat-label">{{ t('sync.updatedLabel') }}</p>
          <p class="bm-muted mt-1 text-xs">{{ formatDate(lastSuccess) }}</p>
          <p class="bm-soft mt-1 text-[11px]">{{ t('sync.lastAttempt') }}: {{ formatDate(lastAttempt) }}</p>
        </article>
      </div>

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="bm-button bm-button-primary text-xs"
          :disabled="isPrimaryActionDisabled"
          @click="onPrimaryAction"
        >
          {{ primaryActionLabel }}
        </button>
        <button
          type="button"
          class="bm-button text-xs"
          @click="toggleDetails"
        >
          {{ showTechnicalDetails ? t('sync.hideDetails') : t('sync.showDetails') }}
        </button>
      </div>

      <p class="bm-muted mt-2 text-xs">
        {{ isOnline ? t('sync.autoSyncHint') : t('sync.offlineHint') }}
      </p>
    </SurfaceCard>

    <SurfaceCard>
      <h2 class="bm-section-title">{{ t('sync.queueTitle') }}</h2>
      <p v-if="queueItems.length === 0" class="bm-muted mt-2 text-sm">{{ t('sync.emptyQueue') }}</p>
      <div v-else class="mt-3 space-y-4">
        <section
          v-for="group in groupedQueueItems"
          :key="`queue-${group.key}`"
          class="bm-subtle-panel"
        >
          <p class="text-sm font-semibold text-(--app-text)">{{ group.label }} ({{ group.items.length }})</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="bm-card"
            >
              <p class="text-sm text-(--app-text)">{{ describeQueueItem(item) }}</p>
              <p class="bm-muted mt-1 text-xs">{{ t('sync.createdAt') }}: {{ formatDate(item.createdAt) }}</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="bm-button bm-button-primary text-[11px]"
                  :disabled="!isOnline"
                  @click="onRetryAll"
                >
                  {{ t('sync.actionSyncNow') }}
                </button>
                <button
                  type="button"
                  class="bm-button bm-button-danger text-[11px]"
                  @click="onDiscardQueueItem(item.id)"
                >
                  {{ t('sync.actionRemove') }}
                </button>
              </div>

              <div v-if="showTechnicalDetails" class="bm-subtle-panel mt-2 p-2">
                <p class="bm-soft text-[11px]">{{ t('sync.techAction') }}: {{ item.action }}</p>
                <p class="bm-soft text-[11px]">{{ t('sync.techId') }}: {{ item.id }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </SurfaceCard>

    <SurfaceCard>
      <h2 class="bm-section-title">{{ t('sync.conflictsTitle') }}</h2>
      <p v-if="conflicts.length === 0" class="bm-muted mt-2 text-sm">{{ t('sync.emptyConflicts') }}</p>
      <div v-else class="mt-3 space-y-4">
        <section
          v-for="group in groupedConflicts"
          :key="`conflict-${group.key}`"
          class="rounded-xl border border-(--app-danger) bg-(--app-danger-soft) p-3"
        >
          <p class="text-sm font-semibold text-(--app-danger)">{{ group.label }} ({{ group.items.length }})</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="item in group.items"
              :key="item.id"
              class="rounded-lg border border-(--app-danger) bg-(--app-surface) p-3"
            >
              <p class="text-sm text-(--app-text)">{{ describeQueueItem(item) }}</p>
              <p class="mt-1 text-xs text-(--app-danger)">{{ t('sync.conflictGuide') }}</p>
              <p class="mt-1 text-xs text-(--app-danger)">{{ t('sync.whatHappened') }}: {{ item.errorMessage }}</p>
              <div class="mt-2 flex gap-2">
                <button
                  type="button"
                  class="bm-button bm-button-primary text-[11px]"
                  @click="onKeepThisDeviceVersion(item.id)"
                >
                  {{ t('sync.keepDeviceVersion') }}
                </button>
                <button
                  type="button"
                  class="bm-button bm-button-danger text-[11px]"
                  @click="onUseCloudVersion(item.id)"
                >
                  {{ t('sync.useCloudVersion') }}
                </button>
              </div>

              <div v-if="showTechnicalDetails" class="mt-2 rounded-md border border-(--app-danger) bg-(--app-danger-soft) p-2">
                <p class="text-[11px] text-(--app-danger)">{{ t('sync.techRetries') }}: {{ item.retryCount }}</p>
                <p class="text-[11px] text-(--app-danger)">{{ t('sync.techFailedAt') }}: {{ formatDate(item.failedAt) }}</p>
                <p class="text-[11px] text-(--app-danger)">{{ t('sync.techNextRetryAt') }}: {{ formatDate(item.nextRetryAt) }}</p>
                <p class="text-[11px] text-(--app-danger)">{{ t('sync.techId') }}: {{ item.id }}</p>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </SurfaceCard>
  </section>
</template>
