import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isSearchBooksError, searchBooks } from '../services/bookSearchService'
import type { LibrarySortMode, LibraryStatusFilter, SearchLanguageMode } from '../types/books-store'
import { deleteSessionsForBook } from '../services/readingSessionService'
import {
  addBookToLibrary,
  deleteLibraryBook,
  fetchLibraryBooks,
  updateLibraryBookMetadata,
  updateLibraryBookFavorite,
} from '../services/libraryService'
import {
  enqueueOfflineLibraryAddBook,
  enqueueOfflineLibraryDeleteBook,
  enqueueOfflineLibraryUpdateFavorite,
  enqueueOfflineLibraryUpdateMetadata,
} from '../services/offlineQueueService'
import type { BookSearchResult, LibraryBook } from '../types/books'
import type { AppLocale } from '../types/i18n'
import { useAuthStore } from './auth'
import { useSessionsStore } from './sessions'

export const useBooksStore = defineStore('books', () => {
  const LIBRARY_CACHE_MAX_AGE_MS = 2 * 60_000
  const query = ref('')
  const searchResults = ref<BookSearchResult[]>([])
  const library = ref<LibraryBook[]>([])
  const searching = ref(false)
  const loadingMoreSearch = ref(false)
  const hasMoreSearchResults = ref(false)
  const searchPage = ref(0)
  const loadingLibrary = ref(false)
  const savingIds = ref<string[]>([])
  const favoriteUpdatingIds = ref<string[]>([])
  const metadataUpdatingIds = ref<string[]>([])
  const deletingIds = ref<string[]>([])
  const selectedLibraryBookId = ref<string | null>(null)
  const showOnlyFavorites = ref(false)
  const libraryStatusFilter = ref<LibraryStatusFilter>('all')
  const librarySearchQuery = ref('')
  const librarySortMode = ref<LibrarySortMode>('favorite_first')
  const searchLanguageMode = ref<SearchLanguageMode>('active')
  const errorKey = ref<string | null>(null)
  const errorDetails = ref<string | null>(null)
  const syncQueuedMessageKey = ref<string | null>(null)
  const libraryLoadedForUid = ref<string | null>(null)
  const libraryLoadedAt = ref<number>(0)
  let libraryLoadPromise: Promise<void> | null = null

  function normalizeFinishedBookProgress(book: LibraryBook): LibraryBook {
    if (book.status !== 'finished' || book.totalPages === null || book.currentPage >= book.totalPages) {
      return book
    }

    return {
      ...book,
      currentPage: book.totalPages,
    }
  }

  function normalizeMetadataPayload(
    payload: Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'>,
  ): Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'> {
    return {
      ...payload,
      currentPage:
        payload.status === 'finished' && payload.totalPages !== null ? payload.totalPages : payload.currentPage,
    }
  }

  const libraryIds = computed(() => new Set(library.value.map((book) => book.id)))
  const selectedBook = computed(() =>
    selectedLibraryBookId.value
      ? library.value.find((book) => book.id === selectedLibraryBookId.value) ?? null
      : null,
  )
  const filteredSortedLibrary = computed(() => {
    const normalizedQuery = librarySearchQuery.value.trim().toLowerCase()
    const base = library.value.filter((book) => {
      if (showOnlyFavorites.value && !book.favorite) return false
      if (libraryStatusFilter.value !== 'all' && book.status !== libraryStatusFilter.value) return false
      if (!normalizedQuery) return true
      const titleMatch = book.title.toLowerCase().includes(normalizedQuery)
      const authorMatch = book.authors.some((author) => author.toLowerCase().includes(normalizedQuery))
      return titleMatch || authorMatch
    })

    if (librarySortMode.value === 'title_asc') {
      return [...base].sort((a, b) => a.title.localeCompare(b.title))
    }

    if (librarySortMode.value === 'recent') {
      return base
    }

    return [...base].sort((a, b) => Number(b.favorite) - Number(a.favorite))
  })

  function clearError() {
    errorKey.value = null
    errorDetails.value = null
  }

  function clearSyncQueuedMessage() {
    syncQueuedMessageKey.value = null
  }

  function isOfflineQueueCandidate(error: unknown): boolean {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return true
    if (!error || typeof error !== 'object') return false
    const candidate = error as { code?: string; message?: string }
    const code = (candidate.code ?? '').toLowerCase()
    const message = (candidate.message ?? '').toLowerCase()
    return (
      code.includes('unavailable') ||
      code.includes('network') ||
      code.includes('deadline-exceeded') ||
      message.includes('network') ||
      message.includes('offline')
    )
  }

  function toLibraryDocId(sourceId: string): string {
    return sourceId.replace(':', '_')
  }

  function toOptimisticLibraryBook(book: BookSearchResult): LibraryBook {
    return {
      id: toLibraryDocId(book.id),
      source: book.source,
      externalId: book.id.split(':')[1] ?? book.id,
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl,
      totalPages: book.totalPages,
      favorite: false,
      currentPage: 0,
      status: 'wishlist',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  function mapSearchError(error: unknown): string {
    if (!isSearchBooksError(error)) return 'books.searchError'
    if (error.code === 'quota_exceeded') return 'books.searchQuotaError'
    if (error.code === 'service_unavailable') return 'books.searchServiceUnavailable'
    if (error.code === 'network_error') return 'books.searchNetworkError'
    return 'books.searchError'
  }

  async function search(queryText: string, locale: AppLocale) {
    clearError()
    query.value = queryText
    searching.value = true
    try {
      const result = await searchBooks(queryText, locale, searchLanguageMode.value, 0, 20)
      searchResults.value = result.items
      searchPage.value = 0
      hasMoreSearchResults.value = result.totalItems > result.items.length
    } catch (error) {
      errorKey.value = mapSearchError(error)
      errorDetails.value = error instanceof Error ? error.message : null
      searchResults.value = []
      hasMoreSearchResults.value = false
    } finally {
      searching.value = false
    }
  }

  function clearSearch() {
    query.value = ''
    searchResults.value = []
    searchPage.value = 0
    hasMoreSearchResults.value = false
    clearError()
  }

  async function loadMoreSearch(locale: AppLocale) {
    if (searching.value || loadingMoreSearch.value || !hasMoreSearchResults.value || !query.value.trim()) return
    loadingMoreSearch.value = true
    try {
      const nextPage = searchPage.value + 1
      const result = await searchBooks(query.value, locale, searchLanguageMode.value, nextPage, 20)
      const merged = new Map<string, BookSearchResult>()
      for (const item of searchResults.value) merged.set(item.id, item)
      for (const item of result.items) {
        if (!merged.has(item.id)) merged.set(item.id, item)
      }
      searchResults.value = Array.from(merged.values())
      searchPage.value = nextPage
      hasMoreSearchResults.value = result.totalItems > searchResults.value.length
    } catch (error) {
      errorKey.value = mapSearchError(error)
      errorDetails.value = error instanceof Error ? error.message : null
    } finally {
      loadingMoreSearch.value = false
    }
  }

  function setSearchLanguageMode(mode: SearchLanguageMode) {
    searchLanguageMode.value = mode
  }

  async function loadLibrary(options?: { force?: boolean; maxAgeMs?: number }) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      library.value = []
      libraryLoadedForUid.value = null
      libraryLoadedAt.value = 0
      libraryLoadPromise = null
      return
    }

    const force = options?.force === true
    const maxAgeMs = options?.maxAgeMs ?? LIBRARY_CACHE_MAX_AGE_MS
    const sameUid = libraryLoadedForUid.value === uid
    const hasData = library.value.length > 0
    const cacheFresh = Date.now() - libraryLoadedAt.value <= maxAgeMs
    if (!force && sameUid && hasData && cacheFresh) return

    if (libraryLoadPromise) {
      await libraryLoadPromise
      return
    }

    clearError()
    loadingLibrary.value = true
    libraryLoadPromise = (async () => {
      try {
        library.value = (await fetchLibraryBooks(uid)).map(normalizeFinishedBookProgress)
        libraryLoadedForUid.value = uid
        libraryLoadedAt.value = Date.now()
        if (!selectedLibraryBookId.value) {
          const firstBook = library.value[0]
          selectedLibraryBookId.value = firstBook ? firstBook.id : null
        }
      } catch (error) {
        errorKey.value = 'books.loadLibraryError'
        errorDetails.value = error instanceof Error ? error.message : null
      } finally {
        loadingLibrary.value = false
        libraryLoadPromise = null
      }
    })()
    await libraryLoadPromise
  }

  async function ensureLibraryLoaded() {
    await loadLibrary()
  }

  async function addSearchResultToLibrary(book: BookSearchResult) {
    clearError()
    clearSyncQueuedMessage()
    const authStore = useAuthStore()
    if (!authStore.user?.uid) {
      errorKey.value = 'books.authRequired'
      return
    }

    const libraryId = book.id.replace(':', '_')
    if (libraryIds.value.has(libraryId)) return

    savingIds.value = [...savingIds.value, book.id]
    try {
      const savedBook = normalizeFinishedBookProgress(await addBookToLibrary(authStore.user.uid, book))
      library.value = [savedBook, ...library.value.filter((item) => item.id !== savedBook.id)]
      libraryLoadedForUid.value = authStore.user.uid
      libraryLoadedAt.value = Date.now()
      selectedLibraryBookId.value = savedBook.id
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        const optimisticBook = toOptimisticLibraryBook(book)
        library.value = [optimisticBook, ...library.value.filter((item) => item.id !== optimisticBook.id)]
        libraryLoadedForUid.value = authStore.user.uid
        libraryLoadedAt.value = Date.now()
        selectedLibraryBookId.value = optimisticBook.id
        enqueueOfflineLibraryAddBook(authStore.user.uid, {
          source: book.source,
          externalId: book.id.split(':')[1] ?? book.id,
          title: book.title,
          authors: book.authors,
          coverUrl: book.coverUrl,
          totalPages: book.totalPages,
        })
        syncQueuedMessageKey.value = 'notifications.bookAddedQueuedOffline'
      } else {
        errorKey.value = 'books.addBookError'
        errorDetails.value = error instanceof Error ? error.message : null
      }
    } finally {
      savingIds.value = savingIds.value.filter((id) => id !== book.id)
    }
  }

  function isBookInLibrary(book: BookSearchResult): boolean {
    return libraryIds.value.has(book.id.replace(':', '_'))
  }

  function selectLibraryBook(bookId: string) {
    selectedLibraryBookId.value = bookId
  }

  function getLibraryBookById(bookId: string): LibraryBook | null {
    return library.value.find((book) => book.id === bookId) ?? null
  }

  async function toggleFavorite(bookId: string) {
    clearError()
    clearSyncQueuedMessage()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    const currentBook = library.value.find((book) => book.id === bookId)
    if (!uid || !currentBook) {
      errorKey.value = 'books.authRequired'
      return
    }

    favoriteUpdatingIds.value = [...favoriteUpdatingIds.value, bookId]
    const nextFavorite = !currentBook.favorite

    library.value = library.value.map((book) =>
      book.id === bookId ? { ...book, favorite: nextFavorite } : book,
    )
    libraryLoadedAt.value = Date.now()

    try {
      await updateLibraryBookFavorite(uid, bookId, nextFavorite)
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        enqueueOfflineLibraryUpdateFavorite(uid, {
          bookId,
          favorite: nextFavorite,
        })
        syncQueuedMessageKey.value = 'notifications.bookFavoriteQueuedOffline'
      } else {
        library.value = library.value.map((book) =>
          book.id === bookId ? { ...book, favorite: !nextFavorite } : book,
        )
        libraryLoadedAt.value = Date.now()
        errorKey.value = 'books.favoriteError'
        errorDetails.value = error instanceof Error ? error.message : null
      }
    } finally {
      favoriteUpdatingIds.value = favoriteUpdatingIds.value.filter((id) => id !== bookId)
    }
  }

  async function removeFromLibrary(bookId: string) {
    clearError()
    clearSyncQueuedMessage()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'books.authRequired'
      return
    }

    const previousLibrary = [...library.value]
    deletingIds.value = [...deletingIds.value, bookId]
    library.value = library.value.filter((book) => book.id !== bookId)
    libraryLoadedAt.value = Date.now()
    if (selectedLibraryBookId.value === bookId) {
      selectedLibraryBookId.value = library.value[0]?.id ?? null
    }
    try {
      await deleteSessionsForBook(uid, bookId)
      await deleteLibraryBook(uid, bookId)
      const sessionsStore = useSessionsStore()
      sessionsStore.removeSessionsForBookFromCache(bookId)
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        enqueueOfflineLibraryDeleteBook(uid, { bookId })
        syncQueuedMessageKey.value = 'notifications.bookRemovedQueuedOffline'
      } else {
        library.value = previousLibrary
        libraryLoadedAt.value = Date.now()
        if (selectedLibraryBookId.value === null) {
          selectedLibraryBookId.value = previousLibrary[0]?.id ?? null
        }
        errorKey.value = 'books.removeBookError'
        errorDetails.value = error instanceof Error ? error.message : null
      }
    } finally {
      deletingIds.value = deletingIds.value.filter((id) => id !== bookId)
    }
  }

  async function updateBookMetadata(
    bookId: string,
    payload: Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'>,
  ) {
    clearError()
    clearSyncQueuedMessage()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'books.authRequired'
      return
    }

    const previousBook = library.value.find((book) => book.id === bookId)
    if (!previousBook) return

    const normalizedPayload = normalizeMetadataPayload(payload)

    metadataUpdatingIds.value = [...metadataUpdatingIds.value, bookId]

    library.value = library.value.map((book) =>
      book.id === bookId ? { ...book, ...normalizedPayload } : book,
    )
    libraryLoadedAt.value = Date.now()

    try {
      await updateLibraryBookMetadata(uid, bookId, normalizedPayload)
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        enqueueOfflineLibraryUpdateMetadata(uid, {
          bookId,
          totalPages: normalizedPayload.totalPages,
          currentPage: normalizedPayload.currentPage,
          status: normalizedPayload.status,
        })
        syncQueuedMessageKey.value = 'notifications.bookMetadataQueuedOffline'
      } else {
        library.value = library.value.map((book) =>
          book.id === bookId
            ? {
                ...book,
                totalPages: previousBook.totalPages,
                currentPage: previousBook.currentPage,
                status: previousBook.status,
              }
            : book,
        )
        libraryLoadedAt.value = Date.now()
        errorKey.value = 'books.updateBookError'
        errorDetails.value = error instanceof Error ? error.message : null
      }
    } finally {
      metadataUpdatingIds.value = metadataUpdatingIds.value.filter((id) => id !== bookId)
    }
  }

  async function recalculateBookProgressFromSessions(bookId: string) {
    clearError()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    const currentBook = library.value.find((book) => book.id === bookId)
    if (!uid || !currentBook) {
      errorKey.value = 'books.authRequired'
      return
    }

    try {
      const sessionsStore = useSessionsStore()
      await sessionsStore.ensureBookSessionsLoaded(bookId)
      const sessions = sessionsStore.getSessionsForBook(bookId)
      const firstSession = sessions[0]
      const latestEndPage = firstSession ? Math.max(0, firstSession.endPage ?? 0) : 0
      const nextStatus =
        currentBook.totalPages !== null && latestEndPage >= currentBook.totalPages ? 'finished' : 'reading'

      await updateBookMetadata(bookId, {
        totalPages: currentBook.totalPages,
        currentPage: latestEndPage,
        status: nextStatus,
      })
    } catch (error) {
      errorKey.value = 'books.updateBookError'
      errorDetails.value = error instanceof Error ? error.message : null
    }
  }

  return {
    query,
    searchResults,
    library,
    searching,
    loadingMoreSearch,
    hasMoreSearchResults,
    loadingLibrary,
    savingIds,
    favoriteUpdatingIds,
    metadataUpdatingIds,
    deletingIds,
    selectedLibraryBookId,
    showOnlyFavorites,
    libraryStatusFilter,
    librarySearchQuery,
    librarySortMode,
    searchLanguageMode,
    selectedBook,
    filteredSortedLibrary,
    errorKey,
    errorDetails,
    syncQueuedMessageKey,
    search,
    loadMoreSearch,
    setSearchLanguageMode,
    loadLibrary,
    ensureLibraryLoaded,
    addSearchResultToLibrary,
    isBookInLibrary,
    selectLibraryBook,
    getLibraryBookById,
    toggleFavorite,
    updateBookMetadata,
    recalculateBookProgressFromSessions,
    removeFromLibrary,
    clearSearch,
    clearSyncQueuedMessage,
    clearError,
  }
})
