export type StatsRange = '7d' | '30d' | 'all'
export type StatsActivityMetric = 'sessions' | 'pages' | 'minutes'
export type StatsActivityGranularity = 'day' | 'week' | 'month'
export type StatsTimelineSelection = number | 'all'

export interface FirestoreDateLike {
  toDate: () => Date
}

export interface ReadingSessionWithDate {
  id: string
  bookId: string
  startedAtDate: Date
  pagesRead?: number
  durationSeconds?: number
  startPage?: number
  endPage?: number
}

export interface StatsActivityPoint {
  periodStart: number
  periodKey: string
  granularity: StatsActivityGranularity
  sessionCount: number
  pagesRead: number
  minutesRead: number
}

export interface StatsSummary {
  totalSessions: number
  totalPages: number
  totalMinutes: number
  activeDays: number
  currentStreakDays: number
  bestStreakDays: number
  sessionsThisWeek: number
  pagesThisWeek: number
  sessionsThisMonth: number
  minutesThisMonth: number
}

export interface BookStatsEntry {
  bookId: string
  title: string
  sessionCount: number
  totalPages: number
  totalMinutes: number
  avgPagesPerSession: number
  avgMinutesPerSession: number
}

export interface StatsGoalsProgress {
  weeklyPagesGoal: number
  monthlyMinutesGoal: number
  weeklyPagesProgress: number
  monthlyMinutesProgress: number
}

export interface ReadingPlanStatsSummary {
  adherencePercent: number
  metDays: number
  totalDays: number
  atRiskBooks: number
}

export interface BooksTimelineMonthPoint {
  monthKey: string
  year: number
  month: number
  purchasedCount: number
  finishedCount: number
}

export interface BooksTimelineYearSummary {
  year: number
  purchasedCount: number
  finishedCount: number
}
