export type BookMemoryKind = 'quote' | 'idea' | 'question' | 'summary'
export type BookMemoryReviewStatus = 'pending' | 'reviewed'

export interface FirestoreDateLike {
  toDate: () => Date
}

export interface BookMemory {
  id: string
  bookId: string
  kind: BookMemoryKind
  content: string
  page: number | null
  tags: string[]
  favorite: boolean
  reviewStatus: BookMemoryReviewStatus
  nextReviewAt: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export interface CreateBookMemoryInput {
  bookId: string
  kind: BookMemoryKind
  content: string
  page: number | null
  tags: string[]
  favorite?: boolean
}

export interface UpdateBookMemoryInput {
  kind?: BookMemoryKind
  content?: string
  page?: number | null
  tags?: string[]
  favorite?: boolean
  reviewStatus?: BookMemoryReviewStatus
  nextReviewAt?: Date
}

