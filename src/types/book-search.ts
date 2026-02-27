export interface OpenLibraryResponse {
  docs: Array<{
    key?: string
    title?: string
    author_name?: string[]
    first_publish_year?: number
    number_of_pages_median?: number
    edition_count?: number
    language?: string[]
    cover_i?: number
  }>
}

export interface GoogleBooksResponse {
  totalItems?: number
  items?: Array<{
    id: string
    volumeInfo?: {
      title?: string
      authors?: string[]
      publishedDate?: string
      language?: string
      pageCount?: number
      imageLinks?: {
        thumbnail?: string
        smallThumbnail?: string
      }
    }
  }>
}
