export type StreakActivityAction =
  | 'book_added'
  | 'status_changed'
  | 'book_finished'
  | 'reading_session_finished'

export interface StreakDayRecord {
  id: string
  dayId: string
  actions: StreakActivityAction[]
  firstAction: StreakActivityAction
  lastAction: StreakActivityAction
  activityCount: number
  createdAt?: unknown
  updatedAt?: unknown
}

export interface MarkStreakDayPayload {
  dayId: string
  action: StreakActivityAction
}

export interface MarkStreakDayResult {
  created: boolean
  record: StreakDayRecord
}

export interface StreakOverlayPayload {
  action: StreakActivityAction
  currentStreakDays: number
  bestStreakDays: number
  recentDays: Array<{
    dayId: string
    active: boolean
    today: boolean
  }>
}
