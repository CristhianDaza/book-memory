import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isSearchBooksError, searchBooks } from '../services/bookSearchService'
import type { LibrarySortMode, LibraryStatusFilter } from '../types/books-store'
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
import type { BookSearchResult, LibraryBook, LibraryBookMetadataUpdate } from '../types/books'
import { useAuthStore } from './auth'
import { useSessionsStore } from './sessions'
import { useStreakStore } from './streak'
import { isOfflineQueueCandidate } from '../utils/offline'

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
  const errorKey = ref<string | null>(null)
  const errorDetails = ref<string | null>(null)
  const syncQueuedMessageKey = ref<string | null>(null)
  const libraryLoadedForUid = ref<string | null>(null)
  const libraryLoadedAt = ref<number>(0)
  let libraryLoadPromise: Promise<void> | null = null

  function normalizeFinishedBookProgress(book: LibraryBook): LibraryBook {
    const shouldNormalizeProgress =
      book.status === 'finished' && book.totalPages !== null && book.currentPage < book.totalPages
    const completedAt = resolveCompletedAtForFinishedBook(book)
    if (!shouldNormalizeProgress && completedAt === book.completedAt) return book
    return {
      ...book,
      currentPage: shouldNormalizeProgress && book.totalPages !== null ? book.totalPages : book.currentPage,
      completedAt,
    }
  }

  function resolveCompletedAtForFinishedBook(book: LibraryBook): unknown {
    if (book.status !== 'finished') return null
    const existing = parseDateLike(book.completedAt)
    if (existing) return existing
    const fromUpdatedAt = parseDateLike(book.updatedAt)
    if (fromUpdatedAt) return fromUpdatedAt
    return new Date()
  }

  function normalizeMetadataPayload(
    payload: LibraryBookMetadataUpdate,
    previousBook: LibraryBook,
  ): LibraryBookMetadataUpdate {
    const parsedCompletedAt = parseDateLike(payload.completedAt)
    const nextCompletedAt =
      payload.status === 'finished'
        ? parsedCompletedAt === null
          ? previousBook.status === 'finished'
            ? (previousBook.completedAt ?? new Date())
            : new Date()
          : parsedCompletedAt
        : null
    const nextAbandonedReason =
      payload.status === 'abandoned'
        ? payload.abandonedReason === undefined
          ? undefined
          : (payload.abandonedReason?.trim() || null)
        : null
    return {
      ...payload,
      currentPage:
        payload.status === 'finished' && payload.totalPages !== null ? payload.totalPages : payload.currentPage,
      completedAt: nextCompletedAt,
      abandonedReason: nextAbandonedReason,
    }
  }

  function parseDateLike(value: unknown): Date | null {
    if (!value) return null
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value
    }
    if (typeof value === 'string') {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    if (typeof value === 'object' && 'toDate' in value) {
      const dateLike = value as { toDate?: () => Date }
      if (typeof dateLike.toDate !== 'function') return null
      const parsed = dateLike.toDate()
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null
    }
    return null
  }

  function isFutureDate(value: unknown): boolean {
    const parsed = parseDateLike(value)
    if (!parsed) return false
    const maxToday = new Date()
    maxToday.setHours(23, 59, 59, 999)
    return parsed.getTime() > maxToday.getTime()
  }

  function serializeCompletedAtForQueue(value: unknown): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const parsed = parseDateLike(value)
    return parsed ? parsed.toISOString() : null
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
      completedAt: null,
      rating: null,
      note: null,
      abandonedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  async function markStreakActivity(action: 'book_added' | 'status_changed' | 'book_finished') {
    try {
      const streakStore = useStreakStore()
      await streakStore.markTodayActivity(action)
    } catch {
      // Streak tracking must not block the primary library action.
    }
  }

  function mapSearchError(error: unknown): string {
    if (!isSearchBooksError(error)) return 'books.searchError'
    if (error.code === 'quota_exceeded') return 'books.searchQuotaError'
    if (error.code === 'service_unavailable') return 'books.searchServiceUnavailable'
    if (error.code === 'network_error') return 'books.searchNetworkError'
    return 'books.searchError'
  }

  async function search(queryText: string) {
    clearError()
    query.value = queryText
    searching.value = true
    try {
      const result = await searchBooks(queryText, 0, 20)
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

  async function loadMoreSearch() {
    if (searching.value || loadingMoreSearch.value || !hasMoreSearchResults.value || !query.value.trim()) return
    loadingMoreSearch.value = true
    try {
      const nextPage = searchPage.value + 1
      const result = await searchBooks(query.value, nextPage, 20)
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
        const fetchedLibrary = await fetchLibraryBooks(uid)
        const booksToMigrateCompletedAt = fetchedLibrary
          .filter((book) => book.status === 'finished' && !bookHasCompletedAt(book))
          .map((book) => ({
            ...book,
            completedAt: resolveCompletedAtForFinishedBook(book),
          }))
        library.value = fetchedLibrary.map(normalizeFinishedBookProgress)

        if (booksToMigrateCompletedAt.length > 0) {
          for (const book of booksToMigrateCompletedAt) {
            const completedAt = parseDateLike(book.completedAt)
            if (!completedAt) continue
            void updateLibraryBookMetadata(uid, book.id, {
              coverUrl: undefined,
              totalPages: book.totalPages,
              currentPage: book.currentPage,
              status: book.status,
              completedAt,
            }).catch(() => {
              // Best effort migration; avoid blocking the library load flow.
            })
          }
        }
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

  function bookHasCompletedAt(book: LibraryBook): boolean {
    return parseDateLike(book.completedAt) !== null
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
      void markStreakActivity('book_added')
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
        void markStreakActivity('book_added')
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
    payload: LibraryBookMetadataUpdate,
    options?: { trackStreak?: boolean },
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

    const normalizedPayload = normalizeMetadataPayload(payload, previousBook)
    if (isFutureDate(normalizedPayload.completedAt)) {
      errorKey.value = 'books.completedAtFutureError'
      return
    }
    const shouldTrackStreak = options?.trackStreak !== false
    const statusChanged = shouldTrackStreak && previousBook.status !== normalizedPayload.status
    const streakAction = statusChanged
      ? normalizedPayload.status === 'finished'
        ? 'book_finished'
        : 'status_changed'
      : null

    metadataUpdatingIds.value = [...metadataUpdatingIds.value, bookId]

    library.value = library.value.map((book) =>
      book.id === bookId
        ? {
            ...book,
            ...normalizedPayload,
            coverUrl: normalizedPayload.coverUrl === undefined ? book.coverUrl : normalizedPayload.coverUrl,
            rating: normalizedPayload.rating === undefined ? book.rating : normalizedPayload.rating,
            note: normalizedPayload.note === undefined ? book.note : normalizedPayload.note,
            abandonedReason:
              normalizedPayload.abandonedReason === undefined
                ? book.abandonedReason
                : normalizedPayload.abandonedReason,
            completedAt:
              normalizedPayload.completedAt === undefined
                ? book.completedAt
                : normalizedPayload.completedAt,
          }
        : book,
    )
    libraryLoadedAt.value = Date.now()

    try {
      await updateLibraryBookMetadata(uid, bookId, normalizedPayload)
      if (streakAction) void markStreakActivity(streakAction)
    } catch (error) {
      if (isOfflineQueueCandidate(error)) {
        enqueueOfflineLibraryUpdateMetadata(uid, {
          bookId,
          coverUrl: normalizedPayload.coverUrl,
          totalPages: normalizedPayload.totalPages,
          currentPage: normalizedPayload.currentPage,
          status: normalizedPayload.status,
          completedAt: serializeCompletedAtForQueue(normalizedPayload.completedAt),
          rating: normalizedPayload.rating,
          note: normalizedPayload.note,
          abandonedReason: normalizedPayload.abandonedReason,
        })
        syncQueuedMessageKey.value = 'notifications.bookMetadataQueuedOffline'
        if (streakAction) void markStreakActivity(streakAction)
      } else {
        library.value = library.value.map((book) =>
          book.id === bookId
            ? {
                ...book,
                coverUrl: previousBook.coverUrl,
                totalPages: previousBook.totalPages,
                currentPage: previousBook.currentPage,
                status: previousBook.status,
                completedAt: previousBook.completedAt ?? null,
                rating: previousBook.rating,
                note: previousBook.note,
                abandonedReason: previousBook.abandonedReason ?? null,
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

      await updateBookMetadata(
        bookId,
        {
          coverUrl: currentBook.coverUrl,
          totalPages: currentBook.totalPages,
          currentPage: latestEndPage,
          status: nextStatus,
        },
        { trackStreak: false },
      )
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
    selectedBook,
    filteredSortedLibrary,
    errorKey,
    errorDetails,
    syncQueuedMessageKey,
    search,
    loadMoreSearch,
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
