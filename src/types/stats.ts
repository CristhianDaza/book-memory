export type StatsRange = '7d' | '30d' | 'all'

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
  sessionsThisMonth: number
}
