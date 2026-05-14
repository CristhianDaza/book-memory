import type { LibraryBook, ReadingPlan, ReadingPlanInsights } from '../types/books'

const DAY_MS = 86_400_000
const PAGE_TOLERANCE = 5

function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function daysBetween(start: Date, end: Date): number {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  return Math.floor((endDay - startDay) / DAY_MS)
}

function addDays(date: Date, days: number): string {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return toDateKey(next)
}

export function todayKey(now = new Date()): string {
  return toDateKey(now)
}

export function normalizeReadingPlan(value: ReadingPlan | null | undefined): ReadingPlan | null {
  if (!value) return null
  const targetDate = parseDateKey(value.targetDate) ? value.targetDate : null
  const dailyPagesGoal =
    typeof value.dailyPagesGoal === 'number' && Number.isFinite(value.dailyPagesGoal) && value.dailyPagesGoal > 0
      ? Math.floor(value.dailyPagesGoal)
      : null
  const reminderTime = typeof value.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(value.reminderTime)
    ? value.reminderTime
    : null
  const parsedReminderDays = Array.isArray(value.reminderDays)
    ? Array.from(new Set(value.reminderDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort()
    : null
  const reminderDays = parsedReminderDays?.length ? parsedReminderDays : null
  const startDate = parseDateKey(value.startDate) ? value.startDate : todayKey()
  const startPage =
    typeof value.startPage === 'number' && Number.isFinite(value.startPage) && value.startPage >= 0
      ? Math.floor(value.startPage)
      : 0

  return {
    targetDate,
    dailyPagesGoal,
    reminderEnabled: Boolean(value.reminderEnabled),
    reminderTime,
    reminderDays,
    startDate,
    startPage,
  }
}

export function createReadingPlanSnapshot(
  book: LibraryBook,
  input: Omit<ReadingPlan, 'startDate' | 'startPage'>,
  now = new Date(),
): ReadingPlan {
  return normalizeReadingPlan({
    ...input,
    startDate: todayKey(now),
    startPage: Math.max(0, Math.floor(book.currentPage)),
  })!
}

export function getReadingPlanInsights(book: LibraryBook, now = new Date()): ReadingPlanInsights {
  const plan = normalizeReadingPlan(book.readingPlan)
  if (!plan) {
    return emptyInsights('no_plan')
  }
  if (book.status === 'finished') {
    return emptyInsights('completed')
  }
  if (book.status === 'abandoned') {
    return emptyInsights('inactive')
  }

  const remainingPages = book.totalPages === null ? null : Math.max(0, book.totalPages - book.currentPage)
  if (remainingPages === 0 && book.totalPages !== null) {
    return {
      ...emptyInsights('completed'),
      remainingPages: 0,
    }
  }

  const targetDate = parseDateKey(plan.targetDate)
  const startDate = parseDateKey(plan.startDate) ?? now
  const daysRemaining = targetDate ? Math.max(1, daysBetween(now, targetDate) + 1) : null
  const totalPlanDays = targetDate ? Math.max(1, daysBetween(startDate, targetDate) + 1) : null
  const totalPlanPages = book.totalPages === null ? null : Math.max(0, book.totalPages - plan.startPage)
  const requiredDailyPages = remainingPages !== null && daysRemaining !== null
    ? Math.ceil(remainingPages / daysRemaining)
    : null
  const projectedFinishDate = remainingPages !== null && plan.dailyPagesGoal
    ? addDays(now, Math.ceil(remainingPages / plan.dailyPagesGoal))
    : null
  const targetDailyPages = plan.dailyPagesGoal ?? (
    totalPlanPages !== null && totalPlanDays !== null ? Math.ceil(totalPlanPages / totalPlanDays) : null
  )
  const elapsedDays = Math.max(0, daysBetween(startDate, now))
  const expectedCurrentPage = targetDailyPages === null
    ? null
    : Math.min(book.totalPages ?? Number.POSITIVE_INFINITY, plan.startPage + elapsedDays * targetDailyPages)
  const deltaPagesToday = expectedCurrentPage === null ? null : book.currentPage - expectedCurrentPage
  const targetRequiredFromStart = totalPlanPages !== null && totalPlanDays !== null
    ? Math.ceil(totalPlanPages / totalPlanDays)
    : null
  const inconsistentPlan = Boolean(plan.dailyPagesGoal && targetRequiredFromStart && plan.dailyPagesGoal < targetRequiredFromStart)

  if (deltaPagesToday === null) {
    return {
      status: 'on_track',
      remainingPages,
      requiredDailyPages,
      expectedCurrentPage,
      deltaPagesToday,
      projectedFinishDate,
      inconsistentPlan,
    }
  }

  const status =
    deltaPagesToday < -PAGE_TOLERANCE
      ? 'behind'
      : deltaPagesToday > PAGE_TOLERANCE
        ? 'ahead'
        : 'on_track'

  return {
    status,
    remainingPages,
    requiredDailyPages,
    expectedCurrentPage,
    deltaPagesToday,
    projectedFinishDate,
    inconsistentPlan,
  }
}

export function getTodayReadingPlanQueue(books: LibraryBook[], now = new Date()) {
  const priority = { behind: 0, on_track: 1, ahead: 2, no_plan: 3, completed: 4, inactive: 5 }
  return books
    .map((book) => ({ book, insights: getReadingPlanInsights(book, now) }))
    .filter((entry) => ['behind', 'on_track', 'ahead'].includes(entry.insights.status))
    .sort((a, b) => {
      const statusDiff = priority[a.insights.status] - priority[b.insights.status]
      if (statusDiff !== 0) return statusDiff
      return (a.insights.deltaPagesToday ?? 0) - (b.insights.deltaPagesToday ?? 0)
    })
}

function emptyInsights(status: ReadingPlanInsights['status']): ReadingPlanInsights {
  return {
    status,
    remainingPages: null,
    requiredDailyPages: null,
    expectedCurrentPage: null,
    deltaPagesToday: null,
    projectedFinishDate: null,
    inconsistentPlan: false,
  }
}
