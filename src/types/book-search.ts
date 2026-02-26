export interface OpenLibraryResponse {
  docs: Array<{
    key?: string
    title?: string
    author_name?: string[]
    first_publish_year?: number
    number_of_pages_median?: number
    cover_i?: number
  }>
}

export interface GoogleBooksResponse {
  items?: Array<{
    id: string
    volumeInfo?: {
      title?: string
      authors?: string[]
      publishedDate?: string
      pageCount?: number
      imageLinks?: {
        thumbnail?: string
        smallThumbnail?: string
      }
    }
  }>
}
