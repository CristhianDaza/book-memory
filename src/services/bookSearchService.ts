import type { BookSearchResult } from '../types/books'
import type { AppLocale } from '../i18n'

interface OpenLibraryResponse {
  docs: Array<{
    key?: string
    title?: string
    author_name?: string[]
    first_publish_year?: number
    number_of_pages_median?: number
    cover_i?: number
  }>
}

interface GoogleBooksResponse {
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

const MAX_RESULTS = 12
const MIN_FILTERED_RESULTS = 4
const OPEN_LIBRARY_LANG_BY_LOCALE: Record<AppLocale, string> = {
  es: 'spa',
  en: 'eng',
}
const GOOGLE_LANG_BY_LOCALE: Record<AppLocale, string> = {
  es: 'es',
  en: 'en',
}

function normalizeKey(title: string, authors: string[]): string {
  const author = authors[0] ?? ''
  return `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`
}

function parseYear(value?: string): number | null {
  if (!value) return null
  const year = Number.parseInt(value.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

async function searchOpenLibrary(query: string, locale?: AppLocale): Promise<BookSearchResult[]> {
  const languageFilter = locale ? ` language:${OPEN_LIBRARY_LANG_BY_LOCALE[locale]}` : ''
  const q = `${query}${languageFilter}`
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Open Library request failed with status ${response.status}`)

  const data = (await response.json()) as OpenLibraryResponse
  const normalized: BookSearchResult[] = []

  for (const doc of data.docs) {
    const externalId = doc.key?.replace('/works/', '') ?? doc.key ?? ''
    const title = doc.title?.trim() ?? ''
    if (!externalId || !title) continue

    normalized.push({
      id: `openlibrary:${externalId}`,
      source: 'openlibrary',
      title,
      authors: doc.author_name ?? [],
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
      totalPages: doc.number_of_pages_median ?? null,
      publishedYear: doc.first_publish_year ?? null,
    })
  }

  return normalized
}

async function searchGoogleBooks(query: string, locale?: AppLocale): Promise<BookSearchResult[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''
  const langParam = locale ? `&langRestrict=${GOOGLE_LANG_BY_LOCALE[locale]}` : ''
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${MAX_RESULTS}${langParam}${keyParam}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Google Books request failed with status ${response.status}`)

  const data = (await response.json()) as GoogleBooksResponse
  const items = data.items ?? []

  const normalized: BookSearchResult[] = []

  for (const item of items) {
    const info = item.volumeInfo
    const title = info?.title?.trim() ?? ''
    if (!item.id || !title) continue

    normalized.push({
      id: `google:${item.id}`,
      source: 'google',
      title,
      authors: info?.authors ?? [],
      coverUrl: info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? null,
      totalPages: info?.pageCount ?? null,
      publishedYear: parseYear(info?.publishedDate),
    })
  }

  return normalized
}

export async function searchBooks(query: string, locale: AppLocale): Promise<BookSearchResult[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return []

  let openResults = await searchOpenLibrary(trimmedQuery, locale)
  if (openResults.length < MIN_FILTERED_RESULTS) {
    // Fallback sin filtro estricto para no perder resultados.
    openResults = await searchOpenLibrary(trimmedQuery)
  }

  const unique = new Map<string, BookSearchResult>()

  for (const book of openResults) {
    unique.set(normalizeKey(book.title, book.authors), book)
  }

  const needsFallback = openResults.length < 5 || openResults.some((book) => !book.coverUrl || !book.totalPages)
  if (needsFallback) {
    let googleResults = await searchGoogleBooks(trimmedQuery, locale).catch(() => [])
    if (googleResults.length < MIN_FILTERED_RESULTS) {
      googleResults = await searchGoogleBooks(trimmedQuery).catch(() => [])
    }

    for (const book of googleResults) {
      const key = normalizeKey(book.title, book.authors)
      if (!unique.has(key)) unique.set(key, book)
    }
  }

  return Array.from(unique.values()).slice(0, MAX_RESULTS)
}
