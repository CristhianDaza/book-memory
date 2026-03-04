export interface QueuedReadingStatePayload {
  selectedBookId: string
  sessionBookId: string | null
  startPage: number
  endPage: number
  elapsedSeconds: number
  sessionStartedAt: string | null
  running: boolean
  persistedAt: string
}

export interface QueuedFinishSessionPayload {
  transactionId: string
  bookId: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  startPage: number
  endPage: number
  pagesRead: number
  totalPages: number | null
  currentPage: number
  status: 'reading' | 'finished' | 'wishlist'
}

export type OfflineQueueAction = 'save_reading_state' | 'clear_reading_state' | 'finish_reading_session'

export interface OfflineQueueItem {
  id: string
  action: OfflineQueueAction
  uid: string
  payload: QueuedReadingStatePayload | QueuedFinishSessionPayload | null
  createdAt: string
}

export interface OfflineConflictItem {
  id: string
  action: OfflineQueueAction
  uid: string
  payload: QueuedReadingStatePayload | QueuedFinishSessionPayload | null
  createdAt: string
  failedAt: string
}
