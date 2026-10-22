import type { LibraryBook } from './books'
import type { BookMemory } from './memories'
import type { ReadingSessionRecord } from './reading'
import type { CloudReadingState } from './reading-state'
import type { StreakDayRecord } from './streak'
import type { ThemePreferences } from './theme'

export interface UserDataExport {
  exportedAt: string
  uid: string
  library: LibraryBook[]
  memories: BookMemory[]
  sessions: ReadingSessionRecord[]
  readingState: CloudReadingState | null
  goals: {
    weeklyPagesGoal: number
    monthlyMinutesGoal: number
  } | null
  streakDays: StreakDayRecord[]
  appearance: ThemePreferences | null
}
