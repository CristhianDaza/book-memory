import type { BookSearchResult } from './books'

export type LibrarySortMode = 'recent' | 'title_asc' | 'favorite_first'
export type SearchLanguageMode = 'active' | 'all'

export interface SearchBooksPageResult {
  items: BookSearchResult[]
  totalItems: number
}
