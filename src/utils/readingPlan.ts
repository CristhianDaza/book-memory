import type {
  LibraryBook,
  ReadingPlan,
  ReadingPlanComplianceSummary,
  ReadingPlanDayRecord,
  ReadingPlanInsights,
} from '../types/books'
import type { ReadingSessionRecord } from '../types/reading'

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

export function dateKeyFromUnknown(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return toDateKey(value)
  if (typeof value === 'object' && 'toDate' in value) {
    const parsed = (value as { toDate?: () => Date }).toDate?.()
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? toDateKey(parsed) : null
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed)
  }
  return null
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

export function getReadingPlanTargetPages(book: LibraryBook, now = new Date()): number | null {
  const plan = normalizeReadingPlan(book.readingPlan)
  if (!plan) return null
  const insights = getReadingPlanInsights(book, now)
  const candidates = [insights.requiredDailyPages, plan.dailyPagesGoal].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
  )
  if (candidates.length === 0) return null
  return Math.max(...candidates)
}

export function getBookPagesReadForDay(
  sessions: ReadingSessionRecord[],
  bookId: string,
  dayId: string,
): number {
  return sessions
    .filter((session) => session.bookId === bookId && dateKeyFromUnknown(session.startedAt) === dayId)
    .reduce((total, session) => total + Math.max(0, session.pagesRead ?? 0), 0)
}

export function buildReadingPlanDayRecord(
  book: LibraryBook,
  sessions: ReadingSessionRecord[],
  date = new Date(),
): Omit<ReadingPlanDayRecord, 'id' | 'createdAt' | 'updatedAt'> | null {
  const dayId = todayKey(date)
  const targetPages = getReadingPlanTargetPages(book, date)
  if (targetPages === null) return null
  const actualPages = getBookPagesReadForDay(sessions, book.id, dayId)
  return {
    bookId: book.id,
    dayId,
    targetPages,
    actualPages,
    metGoal: actualPages >= targetPages,
  }
}

export function summarizeReadingPlanCompliance(
  records: ReadingPlanDayRecord[],
  books: LibraryBook[],
  now = new Date(),
): ReadingPlanComplianceSummary {
  const relevantRecords = records.filter((record) => record.targetPages > 0)
  const totalDays = relevantRecords.length
  const metDays = relevantRecords.filter((record) => record.metGoal).length
  const missedDays = Math.max(0, totalDays - metDays)
  return {
    totalDays,
    metDays,
    missedDays,
    adherencePercent: totalDays > 0 ? Math.round((metDays / totalDays) * 100) : 0,
    currentStreakDays: getComplianceStreakDays(relevantRecords, now),
    atRiskBookIds: getAtRiskBookIds(relevantRecords, books),
  }
}

export function getAtRiskBookIds(records: ReadingPlanDayRecord[], books: LibraryBook[]): string[] {
  const activeBookIds = new Set(
    books
      .filter((book) => book.readingPlan && !['finished', 'abandoned'].includes(book.status))
      .map((book) => book.id),
  )
  const byBook = new Map<string, ReadingPlanDayRecord[]>()
  records.forEach((record) => {
    if (!activeBookIds.has(record.bookId)) return
    const current = byBook.get(record.bookId) ?? []
    current.push(record)
    byBook.set(record.bookId, current)
  })
  return Array.from(byBook.entries())
    .filter(([, bookRecords]) =>
      [...bookRecords]
        .sort((a, b) => b.dayId.localeCompare(a.dayId))
        .slice(0, 2)
        .filter((record) => !record.metGoal).length >= 2,
    )
    .map(([bookId]) => bookId)
}

function getComplianceStreakDays(records: ReadingPlanDayRecord[], now: Date): number {
  const byDay = new Map<string, ReadingPlanDayRecord[]>()
  records.forEach((record) => {
    const current = byDay.get(record.dayId) ?? []
    current.push(record)
    byDay.set(record.dayId, current)
  })

  let streak = 0
  let cursor = new Date(now)
  for (;;) {
    const dayId = toDateKey(cursor)
    const dayRecords = byDay.get(dayId)
    if (!dayRecords || dayRecords.length === 0) break
    if (!dayRecords.every((record) => record.metGoal)) break
    streak += 1
    cursor = new Date(cursor.getTime() - DAY_MS)
  }
  return streak
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
