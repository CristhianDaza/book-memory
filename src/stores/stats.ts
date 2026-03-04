import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchUserSessions } from '../services/readingSessionService'
import type { ReadingSessionRecord } from '../types/reading'
import type {
  FirestoreDateLike,
  StatsActivityMetric,
  ReadingSessionWithDate,
  StatsActivityPoint,
  StatsRange,
  StatsSummary,
} from '../types/stats'
import { useAuthStore } from './auth'

function parseDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as FirestoreDateLike).toDate()
  }
  return null
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function startOfWeek(date: Date): Date {
  const target = new Date(date)
  const day = target.getDay()
  const diff = day === 0 ? -6 : 1 - day
  target.setDate(target.getDate() + diff)
  target.setHours(0, 0, 0, 0)
  return target
}

function countCurrentStreakDays(daysDesc: number[], todayStart: number): number {
  if (daysDesc.length === 0) return 0
  const latestDay = daysDesc[0]
  if (latestDay === undefined) return 0
  const latestDiff = Math.round((todayStart - latestDay) / 86400000)
  if (latestDiff > 1) return 0

  let streak = 1
  for (let index = 1; index < daysDesc.length; index += 1) {
    const previous = daysDesc[index - 1]
    const current = daysDesc[index]
    if (previous === undefined || current === undefined) continue
    const diffDays = Math.round((previous - current) / 86400000)
    if (diffDays === 0) continue
    if (diffDays === 1) {
      streak += 1
      continue
    }
    break
  }
  return streak
}

function bestStreakDays(daysDesc: number[]): number {
  if (daysDesc.length === 0) return 0
  let best = 1
  let current = 1
  for (let index = 1; index < daysDesc.length; index += 1) {
    const previous = daysDesc[index - 1]
    const day = daysDesc[index]
    if (previous === undefined || day === undefined) continue
    const diffDays = Math.round((previous - day) / 86400000)
    if (diffDays === 0) continue
    if (diffDays === 1) {
      current += 1
      if (current > best) best = current
      continue
    }
    current = 1
  }
  return best
}

export const useStatsStore = defineStore('stats', () => {
  const sessions = ref<ReadingSessionRecord[]>([])
  const loading = ref(false)
  const errorKey = ref<string | null>(null)
  const range = ref<StatsRange>('7d')
  const activityMetric = ref<StatsActivityMetric>('sessions')

  const sessionsWithDates = computed(() =>
    sessions.value
      .map((session) => {
        const startedAt = parseDate(session.startedAt)
        return startedAt ? { ...session, startedAtDate: startedAt } : null
      })
      .filter((session): session is ReadingSessionWithDate => session !== null),
  )

  const filteredSessions = computed(() => {
    if (range.value === 'all') return sessionsWithDates.value
    const now = Date.now()
    const days = range.value === '7d' ? 7 : 30
    const threshold = now - days * 86400000
    return sessionsWithDates.value.filter((session) => session.startedAtDate.getTime() >= threshold)
  })

  const activitySeries = computed<StatsActivityPoint[]>(() => {
    const dayWindow = range.value === '7d' ? 7 : range.value === '30d' ? 30 : null
    const todayStart = startOfDay(new Date())
    const firstSessionDay =
      sessionsWithDates.value.length > 0
        ? Math.min(...sessionsWithDates.value.map((session) => startOfDay(session.startedAtDate)))
        : todayStart
    const threshold = dayWindow === null ? firstSessionDay : todayStart - (dayWindow - 1) * 86400000
    const totalDays = Math.max(1, Math.floor((todayStart - threshold) / 86400000) + 1)

    const buckets = new Map<number, StatsActivityPoint>()
    for (let offset = 0; offset < totalDays; offset += 1) {
      const dayStart = threshold + offset * 86400000
      buckets.set(dayStart, {
        dayStart,
        sessionCount: 0,
        pagesRead: 0,
        minutesRead: 0,
      })
    }

    sessionsWithDates.value.forEach((session) => {
      const dayStart = startOfDay(session.startedAtDate)
      const bucket = buckets.get(dayStart)
      if (!bucket) return
      bucket.sessionCount += 1
      bucket.pagesRead += Math.max(0, session.pagesRead ?? 0)
      bucket.minutesRead += Math.floor(Math.max(0, session.durationSeconds ?? 0) / 60)
    })

    return Array.from(buckets.values())
  })

  const summary = computed<StatsSummary>(() => {
    const now = new Date()
    const currentWeekStart = startOfWeek(now).getTime()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    const totalSessions = filteredSessions.value.length
    const totalPages = filteredSessions.value.reduce((acc, item) => acc + Math.max(0, item.pagesRead ?? 0), 0)
    const totalMinutes = Math.floor(
      filteredSessions.value.reduce((acc, item) => acc + Math.max(0, item.durationSeconds ?? 0), 0) / 60,
    )

    const sessionsThisWeek = sessionsWithDates.value.filter(
      (session) => session.startedAtDate.getTime() >= currentWeekStart,
    ).length

    const sessionsThisMonth = sessionsWithDates.value.filter(
      (session) =>
        session.startedAtDate.getMonth() === currentMonth &&
        session.startedAtDate.getFullYear() === currentYear,
    ).length

    const uniqueDaysDesc = Array.from(
      new Set(
        sessionsWithDates.value
          .map((session) => startOfDay(session.startedAtDate))
          .sort((a, b) => b - a),
      ),
    )

    const currentStreakDays = countCurrentStreakDays(uniqueDaysDesc, startOfDay(now))
    const longestStreakDays = bestStreakDays(uniqueDaysDesc)

    return {
      totalSessions,
      totalPages,
      totalMinutes,
      currentStreakDays,
      bestStreakDays: longestStreakDays,
      sessionsThisWeek,
      sessionsThisMonth,
    }
  })

  function setRange(nextRange: StatsRange) {
    range.value = nextRange
  }

  function setActivityMetric(nextMetric: StatsActivityMetric) {
    activityMetric.value = nextMetric
  }

  async function loadStats() {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      sessions.value = []
      errorKey.value = 'stats.authRequired'
      return
    }

    loading.value = true
    errorKey.value = null
    try {
      sessions.value = await fetchUserSessions(uid)
    } catch {
      sessions.value = []
      errorKey.value = 'stats.loadError'
    } finally {
      loading.value = false
    }
  }

  return {
    sessions,
    loading,
    errorKey,
    range,
    activityMetric,
    summary,
    filteredSessions,
    activitySeries,
    setRange,
    setActivityMetric,
    loadStats,
  }
})
