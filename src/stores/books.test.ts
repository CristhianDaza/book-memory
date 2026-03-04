import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { BookSearchResult, LibraryBook } from '../types/books'
import { useAuthStore } from './auth'
import { useBooksStore } from './books'
import {
  addBookToLibrary,
  deleteLibraryBook,
  fetchLibraryBooks,
  updateLibraryBookFavorite,
  updateLibraryBookMetadata,
} from '../services/libraryService'
import { deleteSessionsForBook, fetchSessionsForBook } from '../services/readingSessionService'
import { searchBooks } from '../services/bookSearchService'

vi.mock('../i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('../services/libraryService', () => ({
  fetchLibraryBooks: vi.fn(),
  addBookToLibrary: vi.fn(),
  deleteLibraryBook: vi.fn(),
  updateLibraryBookMetadata: vi.fn(),
  updateLibraryBookFavorite: vi.fn(),
}))

vi.mock('../services/readingSessionService', () => ({
  fetchSessionsForBook: vi.fn(),
  deleteSessionsForBook: vi.fn(),
}))

vi.mock('../services/bookSearchService', () => ({
  searchBooks: vi.fn(),
  isSearchBooksError: vi.fn(() => false),
}))

function createBook(overrides: Partial<LibraryBook>): LibraryBook {
  return {
    id: 'google_1',
    source: 'google',
    externalId: '1',
    title: 'Sample Book',
    authors: ['Author'],
    coverUrl: null,
    totalPages: 100,
    favorite: false,
    currentPage: 0,
    status: 'reading',
    ...overrides,
  }
}

describe('books store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(fetchLibraryBooks).mockResolvedValue([])
    vi.mocked(addBookToLibrary).mockResolvedValue(createBook({ id: 'manual_1', source: 'manual' }))
    vi.mocked(deleteLibraryBook).mockResolvedValue()
    vi.mocked(updateLibraryBookMetadata).mockResolvedValue()
    vi.mocked(updateLibraryBookFavorite).mockResolvedValue()
    vi.mocked(deleteSessionsForBook).mockResolvedValue()
    vi.mocked(fetchSessionsForBook).mockResolvedValue([])
    vi.mocked(searchBooks).mockResolvedValue({ items: [], totalItems: 0 })
  })

  it('filters library by status, query and favorites', () => {
    const store = useBooksStore()
    store.library = [
      createBook({ id: '1', title: 'Deep Work', authors: ['Cal Newport'], status: 'reading', favorite: true }),
      createBook({ id: '2', title: 'Dune', authors: ['Frank Herbert'], status: 'finished', favorite: false }),
      createBook({ id: '3', title: 'Atomic Habits', authors: ['James Clear'], status: 'reading', favorite: false }),
    ]

    store.libraryStatusFilter = 'reading'
    store.librarySearchQuery = 'james'
    expect(store.filteredSortedLibrary.map((item) => item.id)).toEqual(['3'])

    store.showOnlyFavorites = true
    expect(store.filteredSortedLibrary).toHaveLength(0)

    store.librarySearchQuery = 'deep'
    expect(store.filteredSortedLibrary.map((item) => item.id)).toEqual(['1'])
  })

  it('adds a manual book to library when user is authenticated', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()

    const manualBook: BookSearchResult = {
      id: 'manual:abc',
      source: 'manual',
      title: 'Manual Book',
      authors: ['Me'],
      coverUrl: null,
      totalPages: 222,
      publishedYear: null,
    }

    await store.addSearchResultToLibrary(manualBook)

    expect(addBookToLibrary).toHaveBeenCalledWith('user-1', manualBook)
    expect(store.library[0]?.id).toBe('manual_1')
  })
})
