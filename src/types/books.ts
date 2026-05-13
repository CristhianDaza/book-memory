export type BookSource = 'openlibrary' | 'google' | 'manual'
export type LibraryBookStatus = 'reading' | 'finished' | 'wishlist' | 'paused' | 'abandoned'
export type ReadingPlanStatus = 'no_plan' | 'on_track' | 'behind' | 'ahead' | 'completed' | 'inactive'

export interface ReadingPlan {
  targetDate: string | null
  dailyPagesGoal: number | null
  reminderEnabled: boolean
  reminderTime: string | null
  reminderDays: number[] | null
  startDate: string
  startPage: number
}

export interface ReadingPlanInsights {
  status: ReadingPlanStatus
  remainingPages: number | null
  requiredDailyPages: number | null
  expectedCurrentPage: number | null
  deltaPagesToday: number | null
  projectedFinishDate: string | null
  inconsistentPlan: boolean
}

export interface BookSearchResult {
  id: string
  source: BookSource
  title: string
  authors: string[]
  coverUrl: string | null
  totalPages: number | null
  publishedYear: number | null
}

export interface LibraryBook {
  id: string
  source: BookSource
  externalId: string
  title: string
  authors: string[]
  coverUrl: string | null
  totalPages: number | null
  favorite: boolean
  currentPage: number
  status: LibraryBookStatus
  completedAt?: unknown
  rating: 1 | 2 | 3 | 4 | 5 | null
  note: string | null
  readingPlan: ReadingPlan | null
  abandonedReason?: string | null
  createdAt?: unknown
  updatedAt?: unknown
}

export type LibraryBookMetadataUpdate = Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'> &
  Partial<Pick<LibraryBook, 'coverUrl' | 'rating' | 'note' | 'readingPlan' | 'abandonedReason' | 'completedAt'>>
