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

export interface CreateReadingSessionInput {
  bookId: string
  startedAt: Date
  endedAt: Date
  durationSeconds: number
  startPage: number
  endPage: number
  pagesRead: number
}
