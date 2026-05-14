import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BookDetailView from './BookDetailView.vue'
import { en } from '../../../i18n/messages/en'
import { es } from '../../../i18n/messages/es'
import type { LibraryBook } from '../../../types/books'
import type { ReadingSessionRecord } from '../../../types/reading'

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia')
  return {
    ...actual,
    storeToRefs: <T extends object>(store: T) => store,
  }
})

const mocks = vi.hoisted(() => {
  const activeBook = { value: null as LibraryBook | null }
  const sessionsByBook = { value: [] as ReadingSessionRecord[] }

  return {
    routeParams: { id: 'book-1' },
    routerPush: vi.fn(),
    ensureLibraryLoaded: vi.fn(),
    selectLibraryBook: vi.fn(),
    getLibraryBookById: vi.fn(() => activeBook.value),
    ensureBookSessionsLoaded: vi.fn(async () => sessionsByBook.value),
    getSessionsForBook: vi.fn(() => sessionsByBook.value),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    recalculateBookProgressFromSessions: vi.fn(),
    ensureHistoryLoaded: vi.fn(),
    getRecordsForBook: vi.fn(() => []),
    syncBookDay: vi.fn(),
    updateBookMetadata: vi.fn(),
    removeFromLibrary: vi.fn(),
    toggleFavorite: vi.fn(),
    clearSyncQueuedMessage: vi.fn(),
    notificationsInfo: vi.fn(),
    notificationsSuccess: vi.fn(),
    notificationsError: vi.fn(),
    booksErrorKey: { value: null as string | null },
    activeBook,
    sessionsByBook,
    favoriteUpdatingIds: { value: [] as string[] },
    metadataUpdatingIds: { value: [] as string[] },
    deletingIds: { value: [] as string[] },
    syncQueuedMessageKey: { value: null as string | null },
  }
})

vi.mock('../../../stores/books', () => ({
  useBooksStore: () => ({
    favoriteUpdatingIds: mocks.favoriteUpdatingIds,
    metadataUpdatingIds: mocks.metadataUpdatingIds,
    deletingIds: mocks.deletingIds,
    syncQueuedMessageKey: mocks.syncQueuedMessageKey,
    getLibraryBookById: mocks.getLibraryBookById,
    ensureLibraryLoaded: mocks.ensureLibraryLoaded,
    selectLibraryBook: mocks.selectLibraryBook,
    toggleFavorite: mocks.toggleFavorite,
    updateBookMetadata: mocks.updateBookMetadata,
    removeFromLibrary: mocks.removeFromLibrary,
    recalculateBookProgressFromSessions: mocks.recalculateBookProgressFromSessions,
    clearSyncQueuedMessage: mocks.clearSyncQueuedMessage,
    get errorKey() {
      return mocks.booksErrorKey.value
    },
  }),
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { value: { uid: 'user-1' } },
  }),
}))

vi.mock('../../../stores/sessions', () => ({
  useSessionsStore: () => ({
    ensureBookSessionsLoaded: mocks.ensureBookSessionsLoaded,
    getSessionsForBook: mocks.getSessionsForBook,
    updateSession: mocks.updateSession,
    deleteSession: mocks.deleteSession,
  }),
}))

vi.mock('../../../stores/readingPlanHistory', () => ({
  useReadingPlanHistoryStore: () => ({
    ensureHistoryLoaded: mocks.ensureHistoryLoaded,
    getRecordsForBook: mocks.getRecordsForBook,
    syncBookDay: mocks.syncBookDay,
  }),
}))

vi.mock('../../../stores/notifications', () => ({
  useNotificationsStore: () => ({
    info: mocks.notificationsInfo,
    success: mocks.notificationsSuccess,
    error: mocks.notificationsError,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: mocks.routeParams }),
  useRouter: () => ({ push: mocks.routerPush }),
  RouterLink: {
    props: ['to'],
    template: '<a href="#"><slot /></a>',
  },
}))

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, es },
  })
}

function mountView() {
  return mount(BookDetailView, {
    global: {
      plugins: [makeI18n()],
      stubs: {
        ConfirmModal: true,
        IconButton: {
          props: ['label'],
          template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
        },
        StatusBadge: true,
        StarRating: true,
        RouterLink: true,
      },
    },
  })
}

describe('BookDetailView reading pace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.activeBook.value = {
      id: 'book-1',
      source: 'manual',
      externalId: 'book-1',
      title: 'Deep Work',
      authors: ['Cal Newport'],
      coverUrl: null,
      totalPages: 300,
      favorite: false,
      currentPage: 120,
      status: 'reading',
      completedAt: null,
      rating: null,
      note: null,
      readingPlan: null,
    }
    mocks.sessionsByBook.value = []
    mocks.ensureLibraryLoaded.mockResolvedValue(undefined)
    mocks.ensureBookSessionsLoaded.mockResolvedValue([])
    mocks.recalculateBookProgressFromSessions.mockResolvedValue(undefined)
    mocks.updateBookMetadata.mockResolvedValue(undefined)
    mocks.removeFromLibrary.mockResolvedValue(undefined)
    mocks.toggleFavorite.mockResolvedValue(undefined)
    mocks.routerPush.mockResolvedValue(undefined)
    mocks.booksErrorKey.value = null
  })

  afterEach(() => {
    mocks.routeParams.id = 'book-1'
  })

  it('calculates pace using only valid sessions and shows remaining estimate', async () => {
    mocks.sessionsByBook.value = [
      { id: 's1', bookId: 'book-1', pagesRead: 20, durationSeconds: 1800 },
      { id: 's2', bookId: 'book-1', pagesRead: 10, durationSeconds: 600 },
      { id: 's3', bookId: 'book-1', pagesRead: 0, durationSeconds: 600 },
      { id: 's4', bookId: 'book-1', pagesRead: 5, durationSeconds: 0 },
    ]
    mocks.ensureBookSessionsLoaded.mockResolvedValue(mocks.sessionsByBook.value)

    const wrapper = mountView()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Reading pace')
    expect(text).toContain('Pace: 1.3 min/page')
    expect(text).toContain('Time per 10 pages: 13.3 min')
    expect(text).toContain('Estimated remaining time: 240.0 min')
  })

  it('shows fallback when there are no valid sessions', async () => {
    mocks.sessionsByBook.value = [{ id: 's1', bookId: 'book-1', pagesRead: 0, durationSeconds: 0 }]
    mocks.ensureBookSessionsLoaded.mockResolvedValue(mocks.sessionsByBook.value)

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Not enough data yet.')
  })

  it('hides estimated remaining time when total pages are unknown', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      totalPages: null,
    }
    mocks.sessionsByBook.value = [{ id: 's1', bookId: 'book-1', pagesRead: 20, durationSeconds: 1800 }]
    mocks.ensureBookSessionsLoaded.mockResolvedValue(mocks.sessionsByBook.value)

    const wrapper = mountView()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('Pace: 1.5 min/page')
    expect(text).not.toContain('Estimated remaining time:')
  })

  it('keeps start reading session action for books already in reading status', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Start reading session')
    expect(wrapper.text()).not.toContain('Start Reading')
  })

  it('shows Start Reading and updates status for wishlist books before navigating', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      status: 'wishlist',
    }

    const wrapper = mountView()
    await flushPromises()

    const startReadingButton = wrapper.findAll('button').find((button) => button.text().includes('Start Reading'))
    expect(startReadingButton).toBeDefined()
    await startReadingButton!.trigger('click')

    expect(mocks.updateBookMetadata).toHaveBeenCalledWith('book-1', {
      coverUrl: null,
      totalPages: 300,
      currentPage: 120,
      status: 'reading',
      rating: null,
      note: null,
      abandonedReason: null,
    })
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'reading', query: { bookId: 'book-1' } })
  })

  it('shows Start Reading and updates status for paused books before navigating', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      status: 'paused',
    }

    const wrapper = mountView()
    await flushPromises()

    const startReadingButton = wrapper.findAll('button').find((button) => button.text().includes('Start Reading'))
    expect(startReadingButton).toBeDefined()
    await startReadingButton!.trigger('click')

    expect(mocks.updateBookMetadata).toHaveBeenCalledWith('book-1', {
      coverUrl: null,
      totalPages: 300,
      currentPage: 120,
      status: 'reading',
      rating: null,
      note: null,
      abandonedReason: null,
    })
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'reading', query: { bookId: 'book-1' } })
  })

  it('does not navigate and shows error when status update fails before Start Reading', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      status: 'wishlist',
    }
    mocks.updateBookMetadata.mockImplementation(async () => {
      mocks.booksErrorKey.value = 'books.updateBookError'
    })

    const wrapper = mountView()
    await flushPromises()

    const startReadingButton = wrapper.findAll('button').find((button) => button.text().includes('Start Reading'))
    expect(startReadingButton).toBeDefined()
    await startReadingButton!.trigger('click')

    expect(mocks.routerPush).not.toHaveBeenCalledWith({ name: 'reading', query: { bookId: 'book-1' } })
    expect(mocks.notificationsError).toHaveBeenCalled()
  })

  it('keeps completed date field hidden inline when transitioning to finished', async () => {
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text().includes('Edit'))
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)

    const statusSelect = wrapper.find('select')
    await statusSelect.setValue('finished')
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
  })

  it('shows completed metadata inline when editing an already finished book', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      status: 'finished',
      currentPage: 300,
      completedAt: '2026-01-01T12:00:00.000Z',
      rating: 4,
      note: 'great',
    }

    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text().includes('Edit'))
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')

    expect(wrapper.find('input[type="date"]').exists()).toBe(true)
  })

  it('blocks completion modal save when completed date is in the future', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      rating: 4,
    }
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text().includes('Edit'))
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    await wrapper.find('select').setValue('finished')
    await wrapper.findAll('button').find((button) => button.text().includes('Save changes'))!.trigger('click')

    const modalDateInput = wrapper.find('input[type="date"]')
    expect(modalDateInput.exists()).toBe(true)

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const day = String(tomorrow.getDate()).padStart(2, '0')
    const futureDate = `${tomorrow.getFullYear()}-${month}-${day}`
    await modalDateInput.setValue(futureDate)
    await wrapper.findAll('button').find((button) => button.text().includes('Save rating'))!.trigger('click')

    expect(mocks.updateBookMetadata).not.toHaveBeenCalled()
    expect(mocks.notificationsError).toHaveBeenCalled()
  })

  it('uses today as default completed date in modal and saves valid completion metadata', async () => {
    mocks.activeBook.value = {
      ...mocks.activeBook.value!,
      rating: 4,
    }
    const wrapper = mountView()
    await flushPromises()

    const editButton = wrapper.findAll('button').find((button) => button.text().includes('Edit'))
    expect(editButton).toBeDefined()
    await editButton!.trigger('click')
    await wrapper.find('select').setValue('finished')
    await wrapper.findAll('button').find((button) => button.text().includes('Save changes'))!.trigger('click')

    const modalDateInput = wrapper.find('input[type="date"]')
    expect(modalDateInput.exists()).toBe(true)

    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const todayDate = `${today.getFullYear()}-${month}-${day}`
    expect((modalDateInput.element as HTMLInputElement).value).toBe(todayDate)

    await wrapper.findAll('button').find((button) => button.text().includes('Save rating'))!.trigger('click')

    expect(mocks.updateBookMetadata).toHaveBeenCalledWith(
      'book-1',
      expect.objectContaining({
        status: 'finished',
        rating: expect.any(Number),
        completedAt: expect.any(Date),
      }),
    )
  })
})
