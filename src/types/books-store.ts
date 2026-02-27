export type LibrarySortMode = 'recent' | 'title_asc' | 'favorite_first'

export interface CompleteMissingPagesResult {
  scanned: number
  updated: number
  unresolved: number
  failed: number
}
