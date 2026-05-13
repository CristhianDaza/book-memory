import type { BookSearchResult } from './books'

export type LibrarySortMode = 'recent' | 'title_asc' | 'favorite_first'
export type LibraryStatusFilter = 'all' | 'reading' | 'finished' | 'wishlist' | 'paused' | 'abandoned'

export interface SearchBooksPageResult {
  items: BookSearchResult[]
  totalItems: number
}
