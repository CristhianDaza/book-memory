export interface PersistedReadingState {
  selectedBookId: string
  sessionBookId: string | null
  startPage: number
  endPage: number
  elapsedSeconds: number
  sessionStartedAt: string | null
  running: boolean
  persistedAt: string
}

export interface CloudReadingState {
  selectedBookId: string
  sessionBookId: string | null
  startPage: number
  endPage: number
  elapsedSeconds: number
  sessionStartedAt: Date | null
  running: boolean
  persistedAt: Date
}

export interface ReadingStateTimestampLike {
  toDate: () => Date
}

