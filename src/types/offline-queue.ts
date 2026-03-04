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

export type OfflineQueueAction = 'save_reading_state' | 'clear_reading_state'

export interface OfflineQueueItem {
  id: string
  action: OfflineQueueAction
  uid: string
  payload: QueuedReadingStatePayload | null
  createdAt: string
}

