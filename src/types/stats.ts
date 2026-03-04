export type StatsRange = '7d' | '30d' | 'all'
export type StatsActivityMetric = 'sessions' | 'pages' | 'minutes'

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
  dayStart: number
  sessionCount: number
  pagesRead: number
  minutesRead: number
}

export interface StatsSummary {
  totalSessions: number
  totalPages: number
  totalMinutes: number
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
