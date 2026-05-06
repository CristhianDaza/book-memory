import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchStatsGoals, saveStatsGoals } from '../services/statsGoalsService'
import type { ReadingSessionRecord } from '../types/reading'
import type {
  BookStatsEntry,
  FirestoreDateLike,
  StatsGoalsProgress,
  StatsActivityMetric,
  ReadingSessionWithDate,
  StatsActivityPoint,
  StatsRange,
  StatsSummary,
} from '../types/stats'
import { useAuthStore } from './auth'
import { useBooksStore } from './books'
import { useSessionsStore } from './sessions'
import { useStreakStore } from './streak'

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

export const useStatsStore = defineStore('stats', () => {
  const sessions = ref<ReadingSessionRecord[]>([])
  const libraryTitles = ref<Record<string, string>>({})
  const loading = ref(false)
  const errorKey = ref<string | null>(null)
  const range = ref<StatsRange>('7d')
  const activityMetric = ref<StatsActivityMetric>('sessions')
  const weeklyPagesGoal = ref(100)
  const monthlyMinutesGoal = ref(600)
  const goalsLoadedForUid = ref<string | null>(null)
  let goalsSaveTimer: ReturnType<typeof setTimeout> | null = null

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
    const pagesThisWeek = sessionsWithDates.value
      .filter((session) => session.startedAtDate.getTime() >= currentWeekStart)
      .reduce((acc, item) => acc + Math.max(0, item.pagesRead ?? 0), 0)

    const sessionsThisMonth = sessionsWithDates.value.filter(
      (session) =>
        session.startedAtDate.getMonth() === currentMonth &&
        session.startedAtDate.getFullYear() === currentYear,
    ).length
    const minutesThisMonth = Math.floor(
      sessionsWithDates.value
        .filter(
          (session) =>
            session.startedAtDate.getMonth() === currentMonth &&
            session.startedAtDate.getFullYear() === currentYear,
        )
        .reduce((acc, item) => acc + Math.max(0, item.durationSeconds ?? 0), 0) / 60,
    )

    const streakStore = useStreakStore()

    return {
      totalSessions,
      totalPages,
      totalMinutes,
      currentStreakDays: streakStore.currentStreakDays,
      bestStreakDays: streakStore.bestStreakDays,
      sessionsThisWeek,
      pagesThisWeek,
      sessionsThisMonth,
      minutesThisMonth,
    }
  })

  const topBooks = computed<BookStatsEntry[]>(() => {
    const byBook = new Map<string, Omit<BookStatsEntry, 'avgPagesPerSession' | 'avgMinutesPerSession'>>()

    sessionsWithDates.value.forEach((session) => {
      const current = byBook.get(session.bookId) ?? {
        bookId: session.bookId,
        title: libraryTitles.value[session.bookId] ?? 'Unknown',
        sessionCount: 0,
        totalPages: 0,
        totalMinutes: 0,
      }

      current.sessionCount += 1
      current.totalPages += Math.max(0, session.pagesRead ?? 0)
      current.totalMinutes += Math.floor(Math.max(0, session.durationSeconds ?? 0) / 60)
      byBook.set(session.bookId, current)
    })

    return Array.from(byBook.values())
      .map((item) => ({
        ...item,
        avgPagesPerSession: item.sessionCount > 0 ? item.totalPages / item.sessionCount : 0,
        avgMinutesPerSession: item.sessionCount > 0 ? item.totalMinutes / item.sessionCount : 0,
      }))
      .sort((a, b) => b.totalPages - a.totalPages)
      .slice(0, 5)
  })

  const goalsProgress = computed<StatsGoalsProgress>(() => ({
    weeklyPagesGoal: weeklyPagesGoal.value,
    monthlyMinutesGoal: monthlyMinutesGoal.value,
    weeklyPagesProgress:
      weeklyPagesGoal.value > 0 ? Math.min(100, Math.round((summary.value.pagesThisWeek / weeklyPagesGoal.value) * 100)) : 0,
    monthlyMinutesProgress:
      monthlyMinutesGoal.value > 0
        ? Math.min(100, Math.round((summary.value.minutesThisMonth / monthlyMinutesGoal.value) * 100))
        : 0,
  }))

  function queueSaveGoals() {
    if (goalsSaveTimer) {
      clearTimeout(goalsSaveTimer)
      goalsSaveTimer = null
    }
    goalsSaveTimer = setTimeout(() => {
      const authStore = useAuthStore()
      const uid = authStore.user?.uid
      if (!uid) return
      void saveStatsGoals(uid, {
        weeklyPagesGoal: weeklyPagesGoal.value,
        monthlyMinutesGoal: monthlyMinutesGoal.value,
      })
    }, 400)
  }

  function setRange(nextRange: StatsRange) {
    if (range.value === nextRange) return
    range.value = nextRange
  }

  function setActivityMetric(nextMetric: StatsActivityMetric) {
    activityMetric.value = nextMetric
  }

  function setWeeklyPagesGoal(value: number) {
    weeklyPagesGoal.value = Math.max(1, Math.floor(value || 1))
    queueSaveGoals()
  }

  function setMonthlyMinutesGoal(value: number) {
    monthlyMinutesGoal.value = Math.max(1, Math.floor(value || 1))
    queueSaveGoals()
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
      const booksStore = useBooksStore()
      const sessionsStore = useSessionsStore()
      const streakStore = useStreakStore()
      await Promise.all([booksStore.ensureLibraryLoaded(), sessionsStore.ensureSessionsLoaded()])
      await streakStore.migrateFromSessions(sessionsStore.allSessions)
      sessions.value = sessionsStore.allSessions
      libraryTitles.value = booksStore.library.reduce<Record<string, string>>((acc, book) => {
        acc[book.id] = book.title
        return acc
      }, {})

      if (goalsLoadedForUid.value !== uid) {
        const loadedGoals = await fetchStatsGoals(uid)
        if (loadedGoals) {
          weeklyPagesGoal.value = loadedGoals.weeklyPagesGoal
          monthlyMinutesGoal.value = loadedGoals.monthlyMinutesGoal
        }
        goalsLoadedForUid.value = uid
      }
    } catch {
      sessions.value = []
      libraryTitles.value = {}
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
    topBooks,
    goalsProgress,
    filteredSessions,
    activitySeries,
    setRange,
    setActivityMetric,
    setWeeklyPagesGoal,
    setMonthlyMinutesGoal,
    loadStats,
  }
})
