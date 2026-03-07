import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  enqueueOfflineClearReadingState,
  enqueueOfflineSaveReadingState,
  replayOfflineQueue,
} from '../services/offlineQueueService'
import { clearReadingState, fetchReadingState, saveReadingState } from '../services/readingStateService'
import type { PersistedReadingState } from '../types/reading-state'
import { useAuthStore } from './auth'

const STORAGE_KEY = 'book-memory-reading-session'
const CLOUD_SYNC_DELAY_MS = 600

function canUseLocalStorage(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
}

function isNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export const useReadingStore = defineStore('reading', () => {
  const selectedBookId = ref<string>('')
  const sessionBookId = ref<string | null>(null)
  const startPage = ref<number>(0)
  const endPage = ref<number>(0)
  const elapsedSeconds = ref<number>(0)
  const sessionStartedAt = ref<Date | null>(null)
  const running = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null
  let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null
  let hydratingFromCloud = false
  let onlineListenerInstalled = false
  const hydratedCloudUid = ref<string | null>(null)
  let hydratePromise: Promise<void> | null = null

  const hasActiveSession = computed(() => sessionStartedAt.value !== null)
  let lastTimerTimestampMs: number | null = null

  function buildPersistedPayload(): PersistedReadingState {
    return {
      selectedBookId: selectedBookId.value,
      sessionBookId: sessionBookId.value,
      startPage: startPage.value,
      endPage: endPage.value,
      elapsedSeconds: elapsedSeconds.value,
      sessionStartedAt: sessionStartedAt.value ? sessionStartedAt.value.toISOString() : null,
      running: running.value,
      persistedAt: new Date().toISOString(),
    }
  }

  function persistState() {
    if (!canUseLocalStorage()) return
    const payload = buildPersistedPayload()
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    queueCloudSync(payload)
  }

  async function syncCloud(payload: PersistedReadingState) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid || hydratingFromCloud) return
    if (!isNavigatorOnline()) {
      enqueueOfflineSaveReadingState(uid, payload)
      return
    }

    try {
      await saveReadingState(uid, {
        selectedBookId: payload.selectedBookId,
        sessionBookId: payload.sessionBookId,
        startPage: payload.startPage,
        endPage: payload.endPage,
        elapsedSeconds: payload.elapsedSeconds,
        sessionStartedAt: payload.sessionStartedAt ? new Date(payload.sessionStartedAt) : null,
        running: payload.running,
        persistedAt: payload.persistedAt ? new Date(payload.persistedAt) : new Date(),
      })
    } catch {
      enqueueOfflineSaveReadingState(uid, payload)
    }
  }

  function queueCloudSync(payload: PersistedReadingState) {
    if (cloudSyncTimer) {
      clearTimeout(cloudSyncTimer)
      cloudSyncTimer = null
    }
    cloudSyncTimer = setTimeout(() => {
      void syncCloud(payload)
    }, CLOUD_SYNC_DELAY_MS)
  }

  function installOnlineSyncBridge() {
    if (onlineListenerInstalled || typeof window === 'undefined') return
    onlineListenerInstalled = true
    window.addEventListener('online', () => {
      syncElapsedWithNow()
      const payload = buildPersistedPayload()
      queueCloudSync(payload)
      void replayOfflineQueue()
    })
  }

  function syncElapsedWithNow() {
    if (!running.value || lastTimerTimestampMs === null) return
    const now = Date.now()
    const elapsedSinceLastTick = Math.floor((now - lastTimerTimestampMs) / 1000)
    if (elapsedSinceLastTick <= 0) return
    elapsedSeconds.value += elapsedSinceLastTick
    lastTimerTimestampMs += elapsedSinceLastTick * 1000
    persistState()
  }

  function installForegroundSyncBridge() {
    if (typeof window === 'undefined') return

    const syncOnReturnToForeground = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      syncElapsedWithNow()
    }

    window.addEventListener('focus', syncOnReturnToForeground)
    window.addEventListener('pageshow', syncOnReturnToForeground)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', syncOnReturnToForeground)
    }
  }

  function startTicker() {
    if (timer) return
    timer = setInterval(() => {
      syncElapsedWithNow()
    }, 1000)
  }

  function restoreState() {
    if (!canUseLocalStorage()) return
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw) as PersistedReadingState
      selectedBookId.value = parsed.selectedBookId ?? ''
      sessionBookId.value = parsed.sessionBookId ?? null
      startPage.value = Math.max(0, Math.floor(parsed.startPage ?? 0))
      endPage.value = Math.max(0, Math.floor(parsed.endPage ?? 0))
      elapsedSeconds.value = Math.max(0, Math.floor(parsed.elapsedSeconds ?? 0))
      sessionStartedAt.value = parsed.sessionStartedAt ? new Date(parsed.sessionStartedAt) : null
      running.value = Boolean(parsed.running)

      if (running.value && parsed.persistedAt) {
        const elapsedWhileAway = Math.floor((Date.now() - new Date(parsed.persistedAt).getTime()) / 1000)
        elapsedSeconds.value += Math.max(0, elapsedWhileAway)
      }

      if (running.value && sessionStartedAt.value) {
        lastTimerTimestampMs = Date.now()
        startTicker()
      }
    } catch {
      globalThis.localStorage.removeItem(STORAGE_KEY)
    }
  }

  async function hydrateFromCloud(options?: { force?: boolean }) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) return
    const force = options?.force === true
    if (!force && hydratedCloudUid.value === uid) return
    if (hydratePromise) {
      await hydratePromise
      return
    }

    hydratePromise = (async () => {
      try {
        hydratingFromCloud = true
        const cloud = await fetchReadingState(uid)
        if (!cloud) {
          hydratedCloudUid.value = uid
          return
        }

        const localMillis = sessionStartedAt.value?.getTime() ?? 0
        const cloudMillis = cloud.persistedAt.getTime()
        if (localMillis > 0 && localMillis >= cloudMillis) {
          hydratedCloudUid.value = uid
          return
        }

        selectedBookId.value = cloud.selectedBookId
        sessionBookId.value = cloud.sessionBookId
        startPage.value = Math.max(0, Math.floor(cloud.startPage))
        endPage.value = Math.max(0, Math.floor(cloud.endPage))
        elapsedSeconds.value = Math.max(0, Math.floor(cloud.elapsedSeconds))
        sessionStartedAt.value = cloud.sessionStartedAt
        running.value = cloud.running && cloud.sessionStartedAt !== null

        if (running.value) {
          const elapsedWhileAway = Math.floor((Date.now() - cloud.persistedAt.getTime()) / 1000)
          elapsedSeconds.value += Math.max(0, elapsedWhileAway)
          lastTimerTimestampMs = Date.now()
          startTicker()
        }
        persistState()
        hydratedCloudUid.value = uid
      } finally {
        hydratingFromCloud = false
        hydratePromise = null
      }
    })()
    await hydratePromise
  }

  function setSelectedBook(bookId: string) {
    selectedBookId.value = bookId
    persistState()
  }

  function setStartPage(value: number) {
    startPage.value = Math.max(0, Math.floor(value))
    persistState()
  }

  function setEndPage(value: number) {
    endPage.value = Math.max(0, Math.floor(value))
    persistState()
  }

  function startTimer() {
    if (!sessionStartedAt.value) {
      sessionStartedAt.value = new Date()
      sessionBookId.value = selectedBookId.value || null
    }
    if (running.value) return

    running.value = true
    lastTimerTimestampMs = Date.now()
    startTicker()
    persistState()
  }

  function pauseTimer() {
    running.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    lastTimerTimestampMs = null
    persistState()
  }

  function resetSession() {
    pauseTimer()
    startPage.value = 0
    endPage.value = 0
    elapsedSeconds.value = 0
    sessionStartedAt.value = null
    sessionBookId.value = null
    persistState()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (uid) {
      void clearReadingState(uid).catch(() => {
        enqueueOfflineClearReadingState(uid)
      })
    }
  }

  restoreState()
  installOnlineSyncBridge()
  installForegroundSyncBridge()

  return {
    selectedBookId,
    sessionBookId,
    startPage,
    endPage,
    elapsedSeconds,
    sessionStartedAt,
    running,
    hasActiveSession,
    hydrateFromCloud,
    setSelectedBook,
    setStartPage,
    setEndPage,
    startTimer,
    pauseTimer,
    resetSession,
  }
})
