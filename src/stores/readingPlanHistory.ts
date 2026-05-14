import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  fetchReadingPlanDayRecords,
  toReadingPlanDayRecordId,
  upsertReadingPlanDayRecord,
} from '../services/readingPlanHistoryService'
import { enqueueOfflineReadingPlanDayUpdate } from '../services/offlineQueueService'
import type { LibraryBook, ReadingPlanComplianceSummary, ReadingPlanDayRecord } from '../types/books'
import type { ReadingSessionRecord } from '../types/reading'
import { isOfflineQueueCandidate } from '../utils/offline'
import {
  buildReadingPlanDayRecord,
  summarizeReadingPlanCompliance,
} from '../utils/readingPlan'
import { useAuthStore } from './auth'

export const useReadingPlanHistoryStore = defineStore('readingPlanHistory', () => {
  const records = ref<ReadingPlanDayRecord[]>([])
  const loading = ref(false)
  const errorKey = ref<string | null>(null)
  const loadedUid = ref<string | null>(null)

  const totalRecords = computed(() => records.value.length)

  function upsertLocal(record: ReadingPlanDayRecord) {
    const index = records.value.findIndex((entry) => entry.id === record.id)
    if (index === -1) {
      records.value = [...records.value, record].sort((a, b) => b.dayId.localeCompare(a.dayId))
      return
    }
    records.value = records.value.map((entry) => (entry.id === record.id ? record : entry))
  }

  async function ensureHistoryLoaded() {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      records.value = []
      loadedUid.value = null
      return
    }
    if (loadedUid.value === uid) return
    await refreshHistory()
  }

  async function refreshHistory() {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      records.value = []
      loadedUid.value = null
      return
    }

    loading.value = true
    errorKey.value = null
    try {
      records.value = await fetchReadingPlanDayRecords(uid)
      loadedUid.value = uid
    } catch {
      errorKey.value = 'readingPlanHistory.loadError'
    } finally {
      loading.value = false
    }
  }

  async function syncBookDay(book: LibraryBook, sessions: ReadingSessionRecord[], date = new Date()) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    const payload = buildReadingPlanDayRecord(book, sessions, date)
    if (!uid || !payload) return null

    const id = toReadingPlanDayRecordId(payload.bookId, payload.dayId)
    const previous = records.value.find((entry) => entry.id === id)
    const optimistic: ReadingPlanDayRecord = {
      id,
      ...payload,
      createdAt: previous?.createdAt ?? new Date(),
      updatedAt: new Date(),
    }
    upsertLocal(optimistic)

    try {
      const saved = await upsertReadingPlanDayRecord(uid, payload)
      upsertLocal(saved)
      return saved
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        enqueueOfflineReadingPlanDayUpdate(uid, payload)
        return optimistic
      }
      if (previous) upsertLocal(previous)
      throw error
    }
  }

  function getRecordsForBook(bookId: string): ReadingPlanDayRecord[] {
    return records.value
      .filter((entry) => entry.bookId === bookId)
      .sort((a, b) => b.dayId.localeCompare(a.dayId))
  }

  function summarizeForBooks(books: LibraryBook[]): ReadingPlanComplianceSummary {
    return summarizeReadingPlanCompliance(records.value, books)
  }

  return {
    records,
    loading,
    errorKey,
    loadedUid,
    totalRecords,
    ensureHistoryLoaded,
    refreshHistory,
    syncBookDay,
    getRecordsForBook,
    summarizeForBooks,
  }
})
