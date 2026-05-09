import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { enqueueOfflineStreakDay } from '../services/offlineQueueService'
import { isOfflineQueueCandidate } from '../utils/offline'
import { fetchStreakDays, markStreakDay } from '../services/streakService'
import type { ReadingSessionRecord } from '../types/reading'
import type { StreakActivityAction, StreakDayRecord, StreakOverlayPayload } from '../types/streak'
import { useAuthStore } from './auth'

const DAY_MS = 86400000

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function nextLocalDayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
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
  if (typeof value === 'object' && 'toDate' in value) {
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
  const runs = computeConsecutiveRuns(dayIdsDesc)
  return runs[0] ?? 0
}

function bestStreakDays(dayIdsDesc: string[]): number {
  if (dayIdsDesc.length === 0) return 0
  const runs = computeConsecutiveRuns(dayIdsDesc)
  return runs.length === 0 ? 0 : Math.max(...runs)
}

function computeConsecutiveRuns(dayIdsDesc: string[]): number[] {
  if (dayIdsDesc.length === 0) return []
  const starts: number[] = []
  for (const dayId of dayIdsDesc) {
    const s = dayIdToLocalStart(dayId ?? '')
    if (s === 0) continue
    if (starts.length > 0 && starts[starts.length - 1] === s) continue
    starts.push(s)
  }
  if (starts.length === 0) return []

  const runs: number[] = []
  let current = 1
  for (let i = 1; i < starts.length; i += 1) {
    const diffDays = Math.round((starts[i - 1] - starts[i]) / DAY_MS)
    if (diffDays === 0) {
      continue
    }
    if (diffDays === 1) {
      current += 1
      continue
    }
    runs.push(current)
    current = 1
  }
  runs.push(current)
  return runs
}

export const useStreakStore = defineStore('streak', () => {
  const currentDate = ref(new Date())
  const days = ref<StreakDayRecord[]>([])
  const loading = ref(false)
  const loadedUid = ref<string | null>(null)
  const errorKey = ref<string | null>(null)
  const overlayPayload = ref<StreakOverlayPayload | null>(null)
  const overlayVisible = ref(false)
  let dayRefreshTimer: ReturnType<typeof setTimeout> | null = null
  let loadPromise: Promise<void> | null = null

  const todayId = computed(() => toLocalDayId(currentDate.value))
  const activeDayIdsDesc = computed(() =>
    Array.from(new Set(days.value.map((day) => day.dayId)))
      .filter((dayId) => dayIdToLocalStart(dayId) > 0)
      .sort((a, b) => dayIdToLocalStart(b) - dayIdToLocalStart(a)),
  )
  const currentStreakDays = computed(() => countCurrentStreakDays(activeDayIdsDesc.value, todayId.value))
  const bestStreakDaysValue = computed(() => bestStreakDays(activeDayIdsDesc.value))
  const recentDays = computed(() => {
    const activeSet = new Set(activeDayIdsDesc.value)
    const todayStart = startOfLocalDay(currentDate.value)
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

  function refreshCurrentDay() {
    currentDate.value = new Date()
  }

  function clearDayRefreshTimer() {
    if (dayRefreshTimer === null) return
    clearTimeout(dayRefreshTimer)
    dayRefreshTimer = null
  }

  function scheduleNextDayRefresh() {
    clearDayRefreshTimer()
    const now = currentDate.value
    const delay = Math.max(1000, nextLocalDayStart(now) - now.getTime())
    dayRefreshTimer = setTimeout(() => {
      refreshCurrentDay()
      scheduleNextDayRefresh()
    }, delay)
  }

  scheduleNextDayRefresh()

  onScopeDispose(clearDayRefreshTimer)

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
    refreshCurrentDay()
    scheduleNextDayRefresh()

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
