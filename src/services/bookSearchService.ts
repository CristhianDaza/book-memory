import type { BookSearchResult } from '../types/books'
import type { GoogleBooksResponse, OpenLibraryResponse } from '../types/book-search'
import type { AppLocale } from '../types/i18n'
import type { SearchBooksPageResult, SearchLanguageMode } from '../types/books-store'

export type SearchBooksErrorCode = 'quota_exceeded' | 'service_unavailable' | 'network_error' | 'http_error'

export class SearchBooksError extends Error {
  readonly code: SearchBooksErrorCode

  constructor(code: SearchBooksErrorCode, message: string) {
    super(message)
    this.name = 'SearchBooksError'
    this.code = code
  }
}

export function isSearchBooksError(error: unknown): error is SearchBooksError {
  return error instanceof SearchBooksError
}

const MAX_RESULTS = 40
const PAGE_SIZE = 20
const GOOGLE_LANG_BY_LOCALE: Record<AppLocale, string> = {
  es: 'es',
  en: 'en',
}
const OPENLIBRARY_LANG_BY_LOCALE: Record<AppLocale, string> = {
  es: 'spa',
  en: 'eng',
}
let googleBooksUnavailable = false

function normalizeKey(title: string, authors: string[]): string {
  const author = authors[0] ?? ''
  return `${title.trim().toLowerCase()}::${author.trim().toLowerCase()}`
}

function parseYear(value?: string): number | null {
  if (!value) return null
  const year = Number.parseInt(value.slice(0, 4), 10)
  return Number.isFinite(year) ? year : null
}

function normalizeTotalPages(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return null
  const rounded = Math.floor(parsed)
  return rounded > 0 ? rounded : null
}

async function searchGoogleBooks(
  query: string,
  locale?: AppLocale,
  startIndex = 0,
  maxResults = PAGE_SIZE,
): Promise<SearchBooksPageResult> {
  if (googleBooksUnavailable) {
    throw new SearchBooksError(
      'service_unavailable',
      'Google Books is temporarily unavailable because of previous quota/auth failures.',
    )
  }
  const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
  const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''
  const langParam = locale ? `&langRestrict=${GOOGLE_LANG_BY_LOCALE[locale]}` : ''
  const safeMaxResults = Math.max(1, Math.min(MAX_RESULTS, Math.floor(maxResults)))
  const safeStartIndex = Math.max(0, Math.floor(startIndex))
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${safeMaxResults}&startIndex=${safeStartIndex}${langParam}${keyParam}`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new SearchBooksError('network_error', 'Network error while contacting Google Books.')
  }

  if (!response.ok) {
    if (response.status === 403 || response.status === 429) {
      googleBooksUnavailable = true
      throw new SearchBooksError('quota_exceeded', `Google Books quota/auth error (${response.status}).`)
    }

    if (response.status >= 500) {
      throw new SearchBooksError('service_unavailable', `Google Books service error (${response.status}).`)
    }

    throw new SearchBooksError('http_error', `Google Books request failed with status ${response.status}.`)
  }

  const data = (await response.json()) as GoogleBooksResponse
  const items = data.items ?? []

  const normalized: BookSearchResult[] = []

  for (const item of items) {
    const info = item.volumeInfo
    const title = info?.title?.trim() ?? ''
    if (!item.id || !title) continue
    if (locale && info?.language && info.language.toLowerCase() !== GOOGLE_LANG_BY_LOCALE[locale]) continue

    normalized.push({
      id: `google:${item.id}`,
      source: 'google',
      title,
      authors: info?.authors ?? [],
      coverUrl: info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? null,
      totalPages: normalizeTotalPages(info?.pageCount),
      publishedYear: parseYear(info?.publishedDate),
    })
  }

  return {
    items: normalized,
    totalItems: Math.max(0, data.totalItems ?? normalized.length),
  }
}

async function searchOpenLibrary(
  query: string,
  locale?: AppLocale,
  startIndex = 0,
  maxResults = PAGE_SIZE,
): Promise<SearchBooksPageResult> {
  const safeMaxResults = Math.max(1, Math.min(MAX_RESULTS, Math.floor(maxResults)))
  const safeStartIndex = Math.max(0, Math.floor(startIndex))
  const langParam = locale ? `&language=${encodeURIComponent(OPENLIBRARY_LANG_BY_LOCALE[locale])}` : ''
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${safeMaxResults}&offset=${safeStartIndex}${langParam}`
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new SearchBooksError('network_error', 'Network error while contacting Open Library.')
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new SearchBooksError('service_unavailable', `Open Library service error (${response.status}).`)
    }
    throw new SearchBooksError('http_error', `Open Library request failed with status ${response.status}.`)
  }

  const data = (await response.json()) as OpenLibraryResponse
  const docs = data.docs ?? []
  const normalized: BookSearchResult[] = []

  for (const item of docs) {
    const title = item.title?.trim() ?? ''
    const key = item.key?.trim() ?? ''
    if (!title || !key) continue
    if (locale && item.language?.length) {
      const hasLocaleLang = item.language.some((lang) => lang === OPENLIBRARY_LANG_BY_LOCALE[locale])
      if (!hasLocaleLang) continue
    }

    const externalId = key.replace('/works/', '')
    const coverUrl = item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-M.jpg` : null

    normalized.push({
      id: `openlibrary:${externalId}`,
      source: 'openlibrary',
      title,
      authors: item.author_name ?? [],
      coverUrl,
      totalPages: normalizeTotalPages(item.number_of_pages_median),
      publishedYear: Number.isFinite(item.first_publish_year) ? item.first_publish_year ?? null : null,
    })
  }

  return {
    items: normalized,
    totalItems: Math.max(0, data.numFound ?? normalized.length),
  }
}

export async function searchBooks(
  query: string,
  locale: AppLocale,
  languageMode: SearchLanguageMode,
  page = 0,
  pageSize = PAGE_SIZE,
): Promise<SearchBooksPageResult> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return { items: [], totalItems: 0 }

  const localeFilter = languageMode === 'active' ? locale : undefined
  const startIndex = Math.max(0, Math.floor(page)) * Math.max(1, Math.floor(pageSize))
  const primaryResult = await (async () => {
    try {
      return await searchGoogleBooks(trimmedQuery, localeFilter, startIndex, pageSize)
    } catch (googleError) {
      try {
        return await searchOpenLibrary(trimmedQuery, localeFilter, startIndex, pageSize)
      } catch {
        throw googleError
      }
    }
  })()
  const unique = new Map<string, BookSearchResult>()

  for (const book of primaryResult.items) {
    const key = normalizeKey(book.title, book.authors)
    if (!unique.has(key)) unique.set(key, book)
  }

  return {
    items: Array.from(unique.values()).slice(0, Math.max(1, Math.floor(pageSize))),
    totalItems: primaryResult.totalItems,
  }
}
