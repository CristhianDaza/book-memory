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

export interface QueuedLibraryAddPayload {
  source: 'openlibrary' | 'google' | 'manual'
  externalId: string
  title: string
  authors: string[]
  coverUrl: string | null
  totalPages: number | null
}

export interface QueuedLibraryFavoritePayload {
  bookId: string
  favorite: boolean
}

export interface QueuedLibraryMetadataPayload {
  bookId: string
  coverUrl?: string | null
  totalPages: number | null
  currentPage: number
  status: 'reading' | 'finished' | 'wishlist'
}

export interface QueuedLibraryDeletePayload {
  bookId: string
}

export interface QueuedStreakDayPayload {
  dayId: string
  action: 'book_added' | 'status_changed' | 'book_finished' | 'reading_session_finished'
}

export type OfflineQueueAction =
  | 'save_reading_state'
  | 'clear_reading_state'
  | 'finish_reading_session'
  | 'library_add_book'
  | 'library_update_favorite'
  | 'library_update_metadata'
  | 'library_delete_book'
  | 'streak_mark_day'

export interface OfflineQueueItem {
  id: string
  action: OfflineQueueAction
  uid: string
  payload:
    | QueuedReadingStatePayload
    | QueuedFinishSessionPayload
    | QueuedLibraryAddPayload
    | QueuedLibraryFavoritePayload
    | QueuedLibraryMetadataPayload
    | QueuedLibraryDeletePayload
    | QueuedStreakDayPayload
    | null
  createdAt: string
}

export interface OfflineConflictItem {
  id: string
  action: OfflineQueueAction
  uid: string
  payload:
    | QueuedReadingStatePayload
    | QueuedFinishSessionPayload
    | QueuedLibraryAddPayload
    | QueuedLibraryFavoritePayload
    | QueuedLibraryMetadataPayload
    | QueuedLibraryDeletePayload
    | QueuedStreakDayPayload
    | null
  createdAt: string
  failedAt: string
  errorMessage: string
  retryCount: number
  status: 'open' | 'retrying'
  nextRetryAt: string
}
