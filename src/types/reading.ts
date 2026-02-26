export interface ReadingSessionRecord {
  id: string
  bookId: string
  startedAt?: unknown
  endedAt?: unknown
  durationSeconds?: number
  pagesRead?: number
  startPage?: number
  endPage?: number
}
