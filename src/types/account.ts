import type { LibraryBook } from './books'
import type { ReadingSessionRecord } from './reading'
import type { CloudReadingState } from './reading-state'
import type { StreakDayRecord } from './streak'

export interface UserDataExport {
  exportedAt: string
  uid: string
  library: LibraryBook[]
  sessions: ReadingSessionRecord[]
  readingState: CloudReadingState | null
  goals: {
    weeklyPagesGoal: number
    monthlyMinutesGoal: number
  } | null
  streakDays: StreakDayRecord[]
}
