import type { BookSearchResult } from './books'

export type LibrarySortMode = 'recent' | 'title_asc' | 'favorite_first'
export type SearchLanguageMode = 'active' | 'all'
export type LibraryStatusFilter = 'all' | 'reading' | 'finished' | 'wishlist'

export interface SearchBooksPageResult {
  items: BookSearchResult[]
  totalItems: number
}
