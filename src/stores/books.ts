import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { isSearchBooksError, searchBooks } from '../services/bookSearchService'
import type { LibrarySortMode, SearchLanguageMode } from '../types/books-store'
import { deleteSessionsForBook, fetchSessionsForBook } from '../services/readingSessionService'
import {
  addBookToLibrary,
  deleteLibraryBook,
  fetchLibraryBooks,
  updateLibraryBookMetadata,
  updateLibraryBookFavorite,
} from '../services/libraryService'
import type { BookSearchResult, LibraryBook } from '../types/books'
import type { AppLocale } from '../types/i18n'
import { useAuthStore } from './auth'

export const useBooksStore = defineStore('books', () => {
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
  const librarySortMode = ref<LibrarySortMode>('favorite_first')
  const searchLanguageMode = ref<SearchLanguageMode>('active')
  const errorKey = ref<string | null>(null)
  const errorDetails = ref<string | null>(null)

  const libraryIds = computed(() => new Set(library.value.map((book) => book.id)))
  const selectedBook = computed(() =>
    selectedLibraryBookId.value
      ? library.value.find((book) => book.id === selectedLibraryBookId.value) ?? null
      : null,
  )
  const filteredSortedLibrary = computed(() => {
    const base = showOnlyFavorites.value
      ? library.value.filter((book) => book.favorite)
      : [...library.value]

    if (librarySortMode.value === 'title_asc') {
      return base.sort((a, b) => a.title.localeCompare(b.title))
    }

    if (librarySortMode.value === 'recent') {
      return base
    }

    return base.sort((a, b) => Number(b.favorite) - Number(a.favorite))
  })

  function clearError() {
    errorKey.value = null
    errorDetails.value = null
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

  async function loadLibrary() {
    clearError()
    const authStore = useAuthStore()
    if (!authStore.user?.uid) {
      library.value = []
      return
    }

    loadingLibrary.value = true
    try {
      library.value = await fetchLibraryBooks(authStore.user.uid)
      if (!selectedLibraryBookId.value) {
        const firstBook = library.value[0]
        selectedLibraryBookId.value = firstBook ? firstBook.id : null
      }
    } catch (error) {
      errorKey.value = 'books.loadLibraryError'
      errorDetails.value = error instanceof Error ? error.message : null
    } finally {
      loadingLibrary.value = false
    }
  }

  async function ensureLibraryLoaded() {
    if (library.value.length > 0 || loadingLibrary.value) return
    await loadLibrary()
  }

  async function addSearchResultToLibrary(book: BookSearchResult) {
    clearError()
    const authStore = useAuthStore()
    if (!authStore.user?.uid) {
      errorKey.value = 'books.authRequired'
      return
    }

    const libraryId = book.id.replace(':', '_')
    if (libraryIds.value.has(libraryId)) return

    savingIds.value = [...savingIds.value, book.id]
    try {
      const savedBook = await addBookToLibrary(authStore.user.uid, book)
      library.value = [savedBook, ...library.value.filter((item) => item.id !== savedBook.id)]
      selectedLibraryBookId.value = savedBook.id
    } catch (error) {
      errorKey.value = 'books.addBookError'
      errorDetails.value = error instanceof Error ? error.message : null
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

    try {
      await updateLibraryBookFavorite(uid, bookId, nextFavorite)
    } catch (error) {
      library.value = library.value.map((book) =>
        book.id === bookId ? { ...book, favorite: !nextFavorite } : book,
      )
      errorKey.value = 'books.favoriteError'
      errorDetails.value = error instanceof Error ? error.message : null
    } finally {
      favoriteUpdatingIds.value = favoriteUpdatingIds.value.filter((id) => id !== bookId)
    }
  }

  async function removeFromLibrary(bookId: string) {
    clearError()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'books.authRequired'
      return
    }

    deletingIds.value = [...deletingIds.value, bookId]
    try {
      await deleteSessionsForBook(uid, bookId)
      await deleteLibraryBook(uid, bookId)
      library.value = library.value.filter((book) => book.id !== bookId)

      if (selectedLibraryBookId.value === bookId) {
        selectedLibraryBookId.value = library.value[0]?.id ?? null
      }
    } catch (error) {
      errorKey.value = 'books.removeBookError'
      errorDetails.value = error instanceof Error ? error.message : null
    } finally {
      deletingIds.value = deletingIds.value.filter((id) => id !== bookId)
    }
  }

  async function updateBookMetadata(
    bookId: string,
    payload: Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'>,
  ) {
    clearError()
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'books.authRequired'
      return
    }

    const previousBook = library.value.find((book) => book.id === bookId)
    if (!previousBook) return

    metadataUpdatingIds.value = [...metadataUpdatingIds.value, bookId]

    library.value = library.value.map((book) =>
      book.id === bookId ? { ...book, ...payload } : book,
    )

    try {
      await updateLibraryBookMetadata(uid, bookId, payload)
    } catch (error) {
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
      errorKey.value = 'books.updateBookError'
      errorDetails.value = error instanceof Error ? error.message : null
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
      const sessions = await fetchSessionsForBook(uid, bookId)
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
    librarySortMode,
    searchLanguageMode,
    selectedBook,
    filteredSortedLibrary,
    errorKey,
    errorDetails,
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
    clearError,
  }
})
