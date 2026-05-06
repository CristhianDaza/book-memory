import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createReadingSession,
  deleteReadingSession,
  fetchUserSessions,
  updateReadingSession,
} from '../services/readingSessionService'
import type { CreateReadingSessionInput, ReadingSessionRecord } from '../types/reading'
import { useAuthStore } from './auth'
import { useStreakStore } from './streak'

export const useSessionsStore = defineStore('sessions', () => {
  const allSessions = ref<ReadingSessionRecord[]>([])
  const loading = ref(false)
  const loadedUid = ref<string | null>(null)
  let loadPromise: Promise<void> | null = null

  const sessionsByBookId = computed(() => {
    const grouped = new Map<string, ReadingSessionRecord[]>()
    allSessions.value.forEach((session) => {
      const current = grouped.get(session.bookId) ?? []
      current.push(session)
      grouped.set(session.bookId, current)
    })
    return grouped
  })

  function resetCache() {
    allSessions.value = []
    loadedUid.value = null
    loadPromise = null
  }

  async function ensureSessionsLoaded(options?: { force?: boolean }) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      resetCache()
      return
    }

    const force = options?.force === true
    if (!force && loadedUid.value === uid && allSessions.value.length > 0) return

    if (loadPromise) {
      await loadPromise
      return
    }

    loading.value = true
    loadPromise = (async () => {
      try {
        allSessions.value = await fetchUserSessions(uid)
        loadedUid.value = uid
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()
    await loadPromise
  }

  async function refreshSessions() {
    await ensureSessionsLoaded({ force: true })
  }

  function getSessionsForBook(bookId: string): ReadingSessionRecord[] {
    return sessionsByBookId.value.get(bookId) ?? []
  }

  async function ensureBookSessionsLoaded(bookId: string): Promise<ReadingSessionRecord[]> {
    await ensureSessionsLoaded()
    return getSessionsForBook(bookId)
  }

  async function createSession(payload: CreateReadingSessionInput): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) return
    await createReadingSession(uid, payload)
    await refreshSessions()
    try {
      const streakStore = useStreakStore()
      await streakStore.markTodayActivity('reading_session_finished')
    } catch {
      // Streak tracking must not block session persistence.
    }
  }

  async function updateSession(
    sessionId: string,
    payload: Pick<ReadingSessionRecord, 'startPage' | 'endPage' | 'pagesRead' | 'durationSeconds'>,
  ): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) return
    await updateReadingSession(uid, sessionId, payload)
    const next = allSessions.value.map((session) =>
      session.id === sessionId ? { ...session, ...payload } : session,
    )
    allSessions.value = next
  }

  async function deleteSession(sessionId: string): Promise<void> {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) return
    await deleteReadingSession(uid, sessionId)
    allSessions.value = allSessions.value.filter((session) => session.id !== sessionId)
  }

  function removeSessionsForBookFromCache(bookId: string) {
    allSessions.value = allSessions.value.filter((session) => session.bookId !== bookId)
  }

  const latestSessionMillisByBook = computed<Record<string, number>>(() => {
    const nextMap: Record<string, number> = {}
    allSessions.value.forEach((session) => {
      const startedAt = session.startedAt
      let millis = 0
      if (startedAt instanceof Date) millis = startedAt.getTime()
      else if (startedAt && typeof startedAt === 'object' && 'toDate' in startedAt) {
        millis = (startedAt as { toDate: () => Date }).toDate().getTime()
      }
      const previous = nextMap[session.bookId] ?? 0
      if (previous === 0 || millis > previous) {
        nextMap[session.bookId] = millis
      }
    })
    return nextMap
  })

  return {
    allSessions,
    loading,
    latestSessionMillisByBook,
    ensureSessionsLoaded,
    refreshSessions,
    getSessionsForBook,
    ensureBookSessionsLoaded,
    createSession,
    updateSession,
    deleteSession,
    removeSessionsForBookFromCache,
    resetCache,
  }
})
