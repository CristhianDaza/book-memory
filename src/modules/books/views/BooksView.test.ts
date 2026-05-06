import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BooksView from './BooksView.vue'
import type { BookSearchResult, LibraryBook } from '../../../types/books'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { addBookToLibrary, fetchLibraryBooks } from '../../../services/libraryService'
import { searchBooks } from '../../../services/bookSearchService'

const routerPush = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'es' },
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
  RouterLink: {
    props: ['to'],
    template: '<a href="#"><slot /></a>',
  },
}))

vi.mock('../../../i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('../../../services/libraryService', () => ({
  fetchLibraryBooks: vi.fn(),
  addBookToLibrary: vi.fn(),
  deleteLibraryBook: vi.fn(),
  updateLibraryBookMetadata: vi.fn(),
  updateLibraryBookFavorite: vi.fn(),
}))

vi.mock('../../../services/readingSessionService', () => ({
  deleteSessionsForBook: vi.fn(),
}))

vi.mock('../../../services/bookSearchService', () => ({
  searchBooks: vi.fn(),
  isSearchBooksError: vi.fn(() => false),
}))

vi.mock('../../../services/offlineQueueService', () => ({
  enqueueOfflineLibraryAddBook: vi.fn(),
  enqueueOfflineLibraryDeleteBook: vi.fn(),
  enqueueOfflineLibraryUpdateFavorite: vi.fn(),
  enqueueOfflineLibraryUpdateMetadata: vi.fn(),
}))

const searchResult: BookSearchResult = {
  id: 'google:book-1',
  source: 'google',
  title: 'A very long book title that needs enough room on mobile',
  authors: ['Author One'],
  coverUrl: null,
  totalPages: 321,
  publishedYear: 2024,
}

const savedBook: LibraryBook = {
  id: 'google_book-1',
  source: 'google',
  externalId: 'book-1',
  title: searchResult.title,
  authors: searchResult.authors,
  coverUrl: null,
  totalPages: 321,
  favorite: false,
  currentPage: 0,
  status: 'wishlist',
}

function mountView() {
  setActivePinia(createPinia())
  const authStore = useAuthStore()
  authStore.user = { uid: 'user-1' } as never
  authStore.initialized = true

  return mount(BooksView, {
    global: {
      stubs: {
        PageHeader: {
          template: '<header><slot name="actions" /></header>',
        },
        SurfaceCard: {
          template: '<section><slot /></section>',
        },
        EmptyState: {
          template: '<section><slot /></section>',
        },
        RouterLink: {
          props: ['to'],
          template: '<a href="#"><slot /></a>',
        },
      },
    },
  })
}

async function openSearchResultPagesModal(wrapper: ReturnType<typeof mountView>) {
  await wrapper.find('header .bm-button-primary').trigger('click')
  const input = wrapper.find('.z-40 form input[type="text"]')
  await input.setValue('long title')
  await wrapper.find('form').trigger('submit')
  await flushPromises()

  const addButton = wrapper.findAll('.z-40 .bm-button-success').find((button) => button.text() === 'books.addBook')

  expect(addButton).toBeTruthy()
  await addButton?.trigger('click')
  await wrapper.vm.$nextTick()
}

describe('BooksView add flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchLibraryBooks).mockResolvedValue([])
    vi.mocked(searchBooks).mockResolvedValue({ items: [searchResult], totalItems: 1 })
    vi.mocked(addBookToLibrary).mockResolvedValue(savedBook)
  })

  it('keeps the add modal open and clears search when add another is checked', async () => {
    const wrapper = mountView()
    const booksStore = useBooksStore()

    await openSearchResultPagesModal(wrapper)
    const checkbox = wrapper.find('.z-55 input[type="checkbox"]')
    await checkbox.setValue(true)

    await wrapper.find('.z-55 .bm-button-success').trigger('click')
    await flushPromises()

    expect(routerPush).not.toHaveBeenCalled()
    expect(booksStore.query).toBe('')
    expect(booksStore.searchResults).toEqual([])
    expect(wrapper.text()).toContain('books.title')
    expect(wrapper.text()).toContain('books.searchIdleTitle')
    expect(wrapper.text()).not.toContain('books.addWithPagesTitle')
  })

  it('closes both modals and navigates to the new book when add another is unchecked', async () => {
    const wrapper = mountView()

    await openSearchResultPagesModal(wrapper)

    await wrapper.find('.z-55 .bm-button-success').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({ name: 'book-detail', params: { id: savedBook.id } })
    expect(wrapper.text()).not.toContain('books.title')
    expect(wrapper.text()).not.toContain('books.addWithPagesTitle')
  })

  it('adds a manual cover URL when the search result has no cover', async () => {
    const wrapper = mountView()
    const coverUrl = 'https://example.com/cover.jpg'

    await openSearchResultPagesModal(wrapper)
    await wrapper.find('.z-55 input[type="url"]').setValue(`  ${coverUrl}  `)
    await wrapper.find('.z-55 .bm-button-success').trigger('click')
    await flushPromises()

    expect(addBookToLibrary).toHaveBeenCalledWith('user-1', {
      ...searchResult,
      coverUrl,
      totalPages: 321,
    })
  })
})
