import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { searchBooks } from '../services/bookSearchService'
import { addBookToLibrary, fetchLibraryBooks } from '../services/libraryService'
import type { BookSearchResult, LibraryBook } from '../types/books'
import type { AppLocale } from '../i18n'
import { useAuthStore } from './auth'

export const useBooksStore = defineStore('books', () => {
  const query = ref('')
  const searchResults = ref<BookSearchResult[]>([])
  const library = ref<LibraryBook[]>([])
  const searching = ref(false)
  const loadingLibrary = ref(false)
  const savingIds = ref<string[]>([])
  const errorKey = ref<string | null>(null)
  const errorDetails = ref<string | null>(null)

  const libraryIds = computed(() => new Set(library.value.map((book) => book.id)))

  function clearError() {
    errorKey.value = null
    errorDetails.value = null
  }

  async function search(queryText: string, locale: AppLocale) {
    clearError()
    query.value = queryText
    searching.value = true
    try {
      searchResults.value = await searchBooks(queryText, locale)
    } catch (error) {
      errorKey.value = 'books.searchError'
      errorDetails.value = error instanceof Error ? error.message : null
      searchResults.value = []
    } finally {
      searching.value = false
    }
  }

  function clearSearch() {
    query.value = ''
    searchResults.value = []
    clearError()
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
    } catch (error) {
      errorKey.value = 'books.loadLibraryError'
      errorDetails.value = error instanceof Error ? error.message : null
    } finally {
      loadingLibrary.value = false
    }
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

  return {
    query,
    searchResults,
    library,
    searching,
    loadingLibrary,
    savingIds,
    errorKey,
    errorDetails,
    search,
    loadLibrary,
    addSearchResultToLibrary,
    isBookInLibrary,
    clearSearch,
    clearError,
  }
})
