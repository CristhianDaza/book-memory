export type BookSource = 'openlibrary' | 'google' | 'manual'

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
  status: 'reading' | 'finished' | 'wishlist'
  createdAt?: unknown
  updatedAt?: unknown
}
