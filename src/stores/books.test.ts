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
import { enqueueOfflineLibraryUpdateMetadata } from '../services/offlineQueueService'

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

vi.mock('../services/offlineQueueService', () => ({
  enqueueOfflineLibraryAddBook: vi.fn(),
  enqueueOfflineLibraryDeleteBook: vi.fn(),
  enqueueOfflineLibraryUpdateFavorite: vi.fn(),
  enqueueOfflineLibraryUpdateMetadata: vi.fn(),
}))

const streakMocks = vi.hoisted(() => ({
  markTodayActivity: vi.fn(),
}))

vi.mock('./streak', () => ({
  useStreakStore: () => ({
    markTodayActivity: streakMocks.markTodayActivity,
  }),
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
    rating: null,
    note: null,
    ...overrides,
  }
}

describe('books store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(fetchLibraryBooks).mockResolvedValue([])
    vi.mocked(addBookToLibrary).mockResolvedValue(createBook({ id: 'manual_1', source: 'manual', status: 'wishlist' }))
    vi.mocked(deleteLibraryBook).mockResolvedValue()
    vi.mocked(updateLibraryBookMetadata).mockResolvedValue()
    vi.mocked(updateLibraryBookFavorite).mockResolvedValue()
    vi.mocked(deleteSessionsForBook).mockResolvedValue()
    vi.mocked(fetchSessionsForBook).mockResolvedValue([])
    vi.mocked(searchBooks).mockResolvedValue({ items: [], totalItems: 0 })
    streakMocks.markTodayActivity.mockResolvedValue(false)
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
    expect(store.library[0]?.status).toBe('wishlist')
    expect(streakMocks.markTodayActivity).toHaveBeenCalledWith('book_added')
  })

  it('sets progress to total pages when a book is marked as finished', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [createBook({ id: 'book-1', totalPages: 320, currentPage: 12, status: 'reading' })]

    await store.updateBookMetadata('book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 12,
      status: 'finished',
    })

    expect(store.library[0]?.currentPage).toBe(320)
    expect(store.library[0]?.status).toBe('finished')
    expect(updateLibraryBookMetadata).toHaveBeenCalledWith('user-1', 'book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 320,
      status: 'finished',
      abandonedReason: null,
    })
    expect(streakMocks.markTodayActivity).toHaveBeenCalledWith('book_finished')
  })

  it('updates a missing cover URL through metadata', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    const coverUrl = 'https://example.com/cover.jpg'
    store.library = [createBook({ id: 'book-1', coverUrl: null, totalPages: 320, currentPage: 12 })]

    await store.updateBookMetadata('book-1', {
      coverUrl,
      totalPages: 320,
      currentPage: 12,
      status: 'reading',
    })

    expect(store.library[0]?.coverUrl).toBe(coverUrl)
    expect(updateLibraryBookMetadata).toHaveBeenCalledWith('user-1', 'book-1', {
      coverUrl,
      totalPages: 320,
      currentPage: 12,
      status: 'reading',
      abandonedReason: null,
    })
  })

  it('updates rating and note through metadata', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [createBook({ id: 'book-1', totalPages: 320, currentPage: 40, status: 'reading' })]

    await store.updateBookMetadata('book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 40,
      status: 'reading',
      rating: 5,
      note: 'Great ending',
    })

    expect(store.library[0]?.rating).toBe(5)
    expect(store.library[0]?.note).toBe('Great ending')
    expect(updateLibraryBookMetadata).toHaveBeenCalledWith('user-1', 'book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 40,
      status: 'reading',
      rating: 5,
      note: 'Great ending',
    })
  })

  it('queues rating and note metadata update when offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    vi.mocked(updateLibraryBookMetadata).mockRejectedValue(new Error('offline'))
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [createBook({ id: 'book-1', totalPages: 300, currentPage: 20, status: 'reading' })]

    await store.updateBookMetadata('book-1', {
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
      rating: 4,
      note: 'Nice book',
    })

    expect(enqueueOfflineLibraryUpdateMetadata).toHaveBeenCalledWith('user-1', {
      bookId: 'book-1',
      coverUrl: undefined,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
      rating: 4,
      note: 'Nice book',
    })
    expect(store.library[0]?.rating).toBe(4)
    expect(store.library[0]?.note).toBe('Nice book')
    vi.unstubAllGlobals()
  })

  it('normalizes finished book progress when loading existing library data', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    vi.mocked(fetchLibraryBooks).mockResolvedValue([
      createBook({ id: 'book-1', totalPages: 450, currentPage: 0, status: 'finished' }),
    ])
    const store = useBooksStore()

    await store.ensureLibraryLoaded()

    expect(store.library[0]?.currentPage).toBe(450)
    expect(store.library[0]?.status).toBe('finished')
  })

  it('keeps paused books out of reading status while preserving progress', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [createBook({ id: 'book-1', totalPages: 320, currentPage: 120, status: 'reading' })]

    await store.updateBookMetadata('book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'paused',
      abandonedReason: null,
    })

    expect(store.library[0]?.currentPage).toBe(120)
    expect(store.library[0]?.status).toBe('paused')
  })

  it('persists abandoned reason when a book is marked as abandoned', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [createBook({ id: 'book-1', totalPages: 320, currentPage: 120, status: 'reading' })]

    await store.updateBookMetadata('book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'abandoned',
      abandonedReason: 'No conecté con el ritmo.',
    })

    expect(store.library[0]?.status).toBe('abandoned')
    expect(store.library[0]?.abandonedReason).toBe('No conecté con el ritmo.')
    expect(updateLibraryBookMetadata).toHaveBeenCalledWith('user-1', 'book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'abandoned',
      abandonedReason: 'No conecté con el ritmo.',
    })
  })

  it('clears abandoned reason when changing from abandoned to another status', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [
      createBook({
        id: 'book-1',
        totalPages: 320,
        currentPage: 120,
        status: 'abandoned',
        abandonedReason: 'No conecté con el ritmo.',
      }),
    ]

    await store.updateBookMetadata('book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'wishlist',
      abandonedReason: 'debe limpiarse',
    })

    expect(store.library[0]?.status).toBe('wishlist')
    expect(store.library[0]?.abandonedReason).toBeNull()
    expect(updateLibraryBookMetadata).toHaveBeenCalledWith('user-1', 'book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'wishlist',
      abandonedReason: null,
    })
  })

  it('queues abandoned reason in offline metadata updates', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useBooksStore()
    store.library = [createBook({ id: 'book-1', totalPages: 320, currentPage: 120, status: 'reading' })]
    vi.mocked(updateLibraryBookMetadata).mockRejectedValueOnce(new Error('network offline'))

    await store.updateBookMetadata('book-1', {
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'abandoned',
      abandonedReason: 'No conecté con el ritmo.',
    })

    expect(enqueueOfflineLibraryUpdateMetadata).toHaveBeenCalledWith('user-1', {
      bookId: 'book-1',
      coverUrl: null,
      totalPages: 320,
      currentPage: 120,
      status: 'abandoned',
      abandonedReason: 'No conecté con el ritmo.',
    })
  })
})
