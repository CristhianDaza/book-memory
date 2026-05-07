import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  rating: null,
  note: null,
}

const readingBookA: LibraryBook = {
  id: 'reading-book-a',
  source: 'google',
  externalId: 'reading-book-a',
  title: 'Reading Book A',
  authors: ['Author A'],
  coverUrl: null,
  totalPages: 300,
  favorite: false,
  currentPage: 80,
  status: 'reading',
  rating: null,
  note: null,
}

const readingBookB: LibraryBook = {
  id: 'reading-book-b',
  source: 'google',
  externalId: 'reading-book-b',
  title: 'Reading Book B',
  authors: ['Author B'],
  coverUrl: null,
  totalPages: 280,
  favorite: true,
  currentPage: 40,
  status: 'reading',
  rating: null,
  note: null,
}

const wishlistBookA: LibraryBook = {
  id: 'wishlist-book-a',
  source: 'google',
  externalId: 'wishlist-book-a',
  title: 'Wishlist Book A',
  authors: ['Wishlist Author A'],
  coverUrl: null,
  totalPages: 260,
  favorite: false,
  currentPage: 0,
  status: 'wishlist',
  rating: null,
  note: null,
}

const wishlistBookB: LibraryBook = {
  id: 'wishlist-book-b',
  source: 'google',
  externalId: 'wishlist-book-b',
  title: 'Wishlist Book B',
  authors: ['Wishlist Author B'],
  coverUrl: null,
  totalPages: 310,
  favorite: true,
  currentPage: 0,
  status: 'wishlist',
  rating: null,
  note: null,
}

const pausedBook: LibraryBook = {
  id: 'paused-book',
  source: 'google',
  externalId: 'paused-book',
  title: 'Paused Book',
  authors: ['Paused Author'],
  coverUrl: null,
  totalPages: 220,
  favorite: false,
  currentPage: 90,
  status: 'paused',
  rating: null,
  note: null,
}

const abandonedBook: LibraryBook = {
  id: 'abandoned-book',
  source: 'google',
  externalId: 'abandoned-book',
  title: 'Abandoned Book',
  authors: ['Abandoned Author'],
  coverUrl: null,
  totalPages: 180,
  favorite: false,
  currentPage: 45,
  status: 'abandoned',
  rating: null,
  note: null,
  abandonedReason: 'not_for_me',
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
          ...defineComponent({
            setup(_, { slots }) {
              return () => h('header', slots.actions?.())
            },
          }),
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

  afterEach(() => {
    vi.clearAllMocks()
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

describe('BooksView random picker flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchLibraryBooks).mockResolvedValue([wishlistBookA, wishlistBookB, readingBookA])
    vi.mocked(searchBooks).mockResolvedValue({ items: [], totalItems: 0 })
    vi.mocked(addBookToLibrary).mockResolvedValue(savedBook)
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the random picker action button in the header', async () => {
    const wrapper = mountView()
    await flushPromises()
    const randomButton = wrapper
      .findAll('header .bm-button')
      .find((button) => button.text().includes('books.pickRandomAction'))
    expect(randomButton).toBeTruthy()
  })

  it('opens random picker modal with a valid wishlist candidate and can pick another', async () => {
    const wrapper = mountView()
    await flushPromises()

    const randomButton = wrapper
      .findAll('header .bm-button')
      .find((button) => button.text().includes('books.pickRandomAction'))
    expect(randomButton).toBeTruthy()
    await randomButton?.trigger('click')
    await flushPromises()

    const randomModal = wrapper.find('.bm-random-modal')
    expect(wrapper.text()).toContain('books.randomModalTitle')
    expect(
      randomModal.text().includes('Wishlist Book A') || randomModal.text().includes('Wishlist Book B'),
    ).toBe(true)
    expect(randomModal.text()).not.toContain('Reading Book A')

    vi.mocked(Math.random).mockReturnValue(0.99)
    const pickAnotherButton = wrapper.findAll('.z-50 .bm-button').find((button) => button.text() === 'books.randomPickAnother')
    expect(pickAnotherButton).toBeTruthy()
    await pickAnotherButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Wishlist Book B')
  })

  it('navigates to detail when confirming the random pick', async () => {
    const wrapper = mountView()
    await flushPromises()

    const randomButton = wrapper
      .findAll('header .bm-button')
      .find((button) => button.text().includes('books.pickRandomAction'))
    await randomButton?.trigger('click')
    await flushPromises()

    const confirmButton = wrapper.findAll('.z-50 .bm-button-success').find((button) => button.text() === 'books.randomPickThis')
    expect(confirmButton).toBeTruthy()

    const selectedTitle = wrapper.text().includes('Wishlist Book B') ? 'Wishlist Book B' : 'Wishlist Book A'
    const expectedId = selectedTitle === 'Wishlist Book B' ? 'wishlist-book-b' : 'wishlist-book-a'

    await confirmButton?.trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({ name: 'book-detail', params: { id: expectedId } })
  })

  it('shows empty state when there are no wishlist books and does not navigate', async () => {
    vi.mocked(fetchLibraryBooks).mockResolvedValue([pausedBook, abandonedBook])
    const wrapper = mountView()
    await flushPromises()

    const randomButton = wrapper
      .findAll('header .bm-button')
      .find((button) => button.text().includes('books.pickRandomAction'))
    await randomButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('books.randomModalEmptyTitle')
    expect(wrapper.find('.z-50 .bm-button-success').attributes('disabled')).toBeDefined()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('includes paused books when the toggle is enabled', async () => {
    vi.mocked(fetchLibraryBooks).mockResolvedValue([pausedBook, abandonedBook, readingBookA])
    const wrapper = mountView()
    await flushPromises()

    const randomButton = wrapper
      .findAll('header .bm-button')
      .find((button) => button.text().includes('books.pickRandomAction'))
    await randomButton?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('books.randomModalEmptyTitle')

    const includePausedCheckbox = wrapper.find('.z-50 input[type="checkbox"]')
    expect(includePausedCheckbox.exists()).toBe(true)
    await includePausedCheckbox.setValue(true)
    await flushPromises()

    const randomModal = wrapper.find('.bm-random-modal')
    expect(randomModal.text()).toContain('Paused Book')
    expect(randomModal.text()).not.toContain('Reading Book A')
  })

  it('navigates to a paused book detail when paused are included and selected', async () => {
    vi.mocked(fetchLibraryBooks).mockResolvedValue([pausedBook, readingBookA])
    const wrapper = mountView()
    await flushPromises()

    const randomButton = wrapper
      .findAll('header .bm-button')
      .find((button) => button.text().includes('books.pickRandomAction'))
    await randomButton?.trigger('click')
    await flushPromises()

    const includePausedCheckbox = wrapper.find('.z-50 input[type="checkbox"]')
    await includePausedCheckbox.setValue(true)
    await flushPromises()

    const confirmButton = wrapper.findAll('.z-50 .bm-button-success').find((button) => button.text() === 'books.randomPickThis')
    expect(confirmButton).toBeTruthy()
    await confirmButton?.trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({ name: 'book-detail', params: { id: 'paused-book' } })
  })
})
