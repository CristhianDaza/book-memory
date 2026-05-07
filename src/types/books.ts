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
  rating: 1 | 2 | 3 | 4 | 5 | null
  note: string | null
  createdAt?: unknown
  updatedAt?: unknown
}

export type LibraryBookMetadataUpdate = Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'> &
  Partial<Pick<LibraryBook, 'coverUrl' | 'rating' | 'note'>>
