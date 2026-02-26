export type BookSource = 'openlibrary' | 'google'

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
  currentPage: number
  status: 'reading' | 'finished' | 'wishlist'
  createdAt?: unknown
  updatedAt?: unknown
}
