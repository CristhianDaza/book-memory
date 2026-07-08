import { computed, readonly, ref } from 'vue'

export const BOOKS_PAGE_SIZE_OPTIONS = [12, 24, 48] as const
export type BooksPageSize = (typeof BOOKS_PAGE_SIZE_OPTIONS)[number]

const STORAGE_KEY = 'bookmemory-books-page-size'
const DEFAULT_PAGE_SIZE: BooksPageSize = 12

function isValidPageSize(value: number): value is BooksPageSize {
  return BOOKS_PAGE_SIZE_OPTIONS.includes(value as BooksPageSize)
}

function readStoredPageSize(): BooksPageSize {
  if (typeof localStorage === 'undefined') return DEFAULT_PAGE_SIZE
  const stored = Number(localStorage.getItem(STORAGE_KEY))
  return isValidPageSize(stored) ? stored : DEFAULT_PAGE_SIZE
}

const pageSize = ref<BooksPageSize>(readStoredPageSize())

export function useBooksPaginationPreference() {
  function setPageSize(value: number | string) {
    const parsed = Number(value)
    pageSize.value = isValidPageSize(parsed) ? parsed : DEFAULT_PAGE_SIZE
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(pageSize.value))
    }
  }

  return {
    pageSize: readonly(pageSize),
    pageSizeModel: computed({
      get: () => pageSize.value,
      set: setPageSize,
    }),
    pageSizeOptions: BOOKS_PAGE_SIZE_OPTIONS,
    setPageSize,
  }
}
