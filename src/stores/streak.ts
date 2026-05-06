import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { enqueueOfflineStreakDay } from '../services/offlineQueueService'
import { fetchStreakDays, markStreakDay } from '../services/streakService'
import type { ReadingSessionRecord } from '../types/reading'
import type { StreakActivityAction, StreakDayRecord, StreakOverlayPayload } from '../types/streak'
import { useAuthStore } from './auth'

const DAY_MS = 86400000

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function toLocalDayId(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dayIdToLocalStart(dayId: string): number {
  const [year, month, day] = dayId.split('-').map(Number)
  if (!year || !month || !day) return 0
  return new Date(year, month - 1, day).getTime()
}

function parseSessionDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate()
  }
  return null
}

function countCurrentStreakDays(dayIdsDesc: string[], todayId: string): number {
  if (dayIdsDesc.length === 0) return 0
  const todayStart = dayIdToLocalStart(todayId)
  const latestStart = dayIdToLocalStart(dayIdsDesc[0] ?? '')
  if (todayStart === 0 || latestStart === 0) return 0
  const latestDiff = Math.round((todayStart - latestStart) / DAY_MS)
  if (latestDiff > 1) return 0

  let streak = 1
  for (let index = 1; index < dayIdsDesc.length; index += 1) {
    const previousStart = dayIdToLocalStart(dayIdsDesc[index - 1] ?? '')
    const currentStart = dayIdToLocalStart(dayIdsDesc[index] ?? '')
    if (previousStart === 0 || currentStart === 0) continue
    const diffDays = Math.round((previousStart - currentStart) / DAY_MS)
    if (diffDays === 0) continue
    if (diffDays === 1) {
      streak += 1
      continue
    }
    break
  }
  return streak
}

function bestStreakDays(dayIdsDesc: string[]): number {
  if (dayIdsDesc.length === 0) return 0
  let best = 1
  let current = 1
  for (let index = 1; index < dayIdsDesc.length; index += 1) {
    const previousStart = dayIdToLocalStart(dayIdsDesc[index - 1] ?? '')
    const currentStart = dayIdToLocalStart(dayIdsDesc[index] ?? '')
    if (previousStart === 0 || currentStart === 0) continue
    const diffDays = Math.round((previousStart - currentStart) / DAY_MS)
    if (diffDays === 0) continue
    if (diffDays === 1) {
      current += 1
      best = Math.max(best, current)
      continue
    }
    current = 1
  }
  return best
}

function isOfflineQueueCandidate(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  const code = (candidate.code ?? '').toLowerCase()
  const message = (candidate.message ?? '').toLowerCase()
  return (
    code.includes('unavailable') ||
    code.includes('network') ||
    code.includes('timeout') ||
    code.includes('deadline-exceeded') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout')
  )
}

export const useStreakStore = defineStore('streak', () => {
  const days = ref<StreakDayRecord[]>([])
  const loading = ref(false)
  const loadedUid = ref<string | null>(null)
  const errorKey = ref<string | null>(null)
  const overlayPayload = ref<StreakOverlayPayload | null>(null)
  const overlayVisible = ref(false)
  let loadPromise: Promise<void> | null = null

  const todayId = computed(() => toLocalDayId(new Date()))
  const activeDayIdsDesc = computed(() =>
    Array.from(new Set(days.value.map((day) => day.dayId)))
      .filter((dayId) => dayIdToLocalStart(dayId) > 0)
      .sort((a, b) => dayIdToLocalStart(b) - dayIdToLocalStart(a)),
  )
  const currentStreakDays = computed(() => countCurrentStreakDays(activeDayIdsDesc.value, todayId.value))
  const bestStreakDaysValue = computed(() => bestStreakDays(activeDayIdsDesc.value))
  const recentDays = computed(() => {
    const activeSet = new Set(activeDayIdsDesc.value)
    const todayStart = startOfLocalDay(new Date())
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(todayStart - (6 - index) * DAY_MS)
      const dayId = toLocalDayId(date)
      return {
        dayId,
        active: activeSet.has(dayId),
        today: dayId === todayId.value,
      }
    })
  })

  function upsertLocalDay(dayId: string, action: StreakActivityAction): boolean {
    const existing = days.value.find((day) => day.dayId === dayId)
    if (!existing) {
      days.value = [
        {
          id: dayId,
          dayId,
          actions: [action],
          firstAction: action,
          lastAction: action,
          activityCount: 1,
        },
        ...days.value,
      ].sort((a, b) => dayIdToLocalStart(b.dayId) - dayIdToLocalStart(a.dayId))
      return true
    }

    const actions = Array.from(new Set([...existing.actions, action]))
    days.value = days.value.map((day) =>
      day.dayId === dayId
        ? {
            ...day,
            actions,
            lastAction: action,
            activityCount: actions.length,
          }
        : day,
    )
    return false
  }

  function showOverlay(action: StreakActivityAction) {
    overlayPayload.value = {
      action,
      currentStreakDays: currentStreakDays.value,
      bestStreakDays: bestStreakDaysValue.value,
      recentDays: recentDays.value,
    }
    overlayVisible.value = true
  }

  function hideOverlay() {
    overlayVisible.value = false
    setTimeout(() => {
      overlayPayload.value = null
    }, 250)
  }

  async function loadStreak(options?: { force?: boolean }) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      days.value = []
      loadedUid.value = null
      return
    }

    if (!options?.force && loadedUid.value === uid) return
    if (loadPromise) {
      await loadPromise
      return
    }

    loading.value = true
    errorKey.value = null
    loadPromise = (async () => {
      try {
        days.value = await fetchStreakDays(uid)
        loadedUid.value = uid
      } catch {
        errorKey.value = 'streak.loadError'
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()
    await loadPromise
  }

  async function migrateFromSessions(sessions: ReadingSessionRecord[]) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) return
    await loadStreak()

    const existing = new Set(days.value.map((day) => day.dayId))
    const sessionDayIds = Array.from(
      new Set(
        sessions
          .map((session) => parseSessionDate(session.startedAt))
          .filter((date): date is Date => date !== null)
          .map((date) => toLocalDayId(date)),
      ),
    ).filter((dayId) => !existing.has(dayId))

    for (const dayId of sessionDayIds) {
      upsertLocalDay(dayId, 'reading_session_finished')
      try {
        await markStreakDay(uid, { dayId, action: 'reading_session_finished' })
      } catch (error) {
        if (isOfflineQueueCandidate(error)) {
          enqueueOfflineStreakDay(uid, { dayId, action: 'reading_session_finished' })
        }
      }
    }
  }

  async function markTodayActivity(action: StreakActivityAction): Promise<boolean> {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) return false
    const dayId = todayId.value
    const alreadyActive = days.value.some((day) => day.dayId === dayId)

    if (!alreadyActive) {
      upsertLocalDay(dayId, action)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineStreakDay(uid, { dayId, action })
      if (!alreadyActive) showOverlay(action)
      return !alreadyActive
    }

    try {
      const result = await markStreakDay(uid, { dayId, action })
      const created = alreadyActive ? false : result.created
      upsertLocalDay(dayId, action)
      if (created) showOverlay(action)
      return created
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        enqueueOfflineStreakDay(uid, { dayId, action })
        if (!alreadyActive) showOverlay(action)
        return !alreadyActive
      }
      errorKey.value = 'streak.saveError'
      return false
    }
  }

  return {
    days,
    loading,
    errorKey,
    overlayPayload,
    overlayVisible,
    todayId,
    activeDayIdsDesc,
    currentStreakDays,
    bestStreakDays: bestStreakDaysValue,
    recentDays,
    loadStreak,
    migrateFromSessions,
    markTodayActivity,
    hideOverlay,
  }
})
