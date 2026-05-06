import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ReadingView from './ReadingView.vue'
import { en } from '../../../i18n/messages/en'
import { es } from '../../../i18n/messages/es'

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia')
  return {
    ...actual,
    storeToRefs: <T extends object>(store: T) => store,
  }
})

const mocks = vi.hoisted(() => {
  const enqueueOfflineFinishReadingSession = vi.fn()
  const createSession = vi.fn()
  const routerPush = vi.fn()
  const ensureLibraryLoaded = vi.fn()
  const updateBookMetadata = vi.fn()
  const hydrateFromCloud = vi.fn()
  const pauseTimer = vi.fn()
  const resetSession = vi.fn()
  const notificationsSuccess = vi.fn()
  const notificationsError = vi.fn()
  const notificationsInfo = vi.fn()
  const routeQuery: Record<string, string> = {}

  const authStore = {
    user: { value: { uid: 'user-1' } },
  }

  const booksStore = {
    library: {
      value: [
        {
          id: 'book-1',
          source: 'manual',
          externalId: 'book-1',
          title: 'Deep Work',
          authors: ['Cal Newport'],
          coverUrl: null,
          currentPage: 12,
          totalPages: 300,
          favorite: false,
          status: 'reading',
        },
        {
          id: 'book-2',
          source: 'manual',
          externalId: 'book-2',
          title: 'Cuentos completos',
          authors: ['Jorge Luis Borges'],
          coverUrl: 'https://example.com/cuentos.jpg',
          currentPage: 10,
          totalPages: 400,
          favorite: false,
          status: 'reading',
        },
      ],
    },
    ensureLibraryLoaded,
    updateBookMetadata,
  }

  const readingStore = {
    selectedBookId: { value: 'book-1' },
    sessionBookId: { value: 'book-1' as string | null },
    startPage: { value: 10 },
    endPage: { value: 10 },
    elapsedSeconds: { value: 120 },
    running: { value: true },
    hasActiveSession: { value: true },
    sessionStartedAt: { value: new Date('2026-03-04T12:00:00.000Z') as Date | null },
    setSelectedBook: vi.fn((value: string) => {
      readingStore.selectedBookId.value = value
    }),
    setStartPage: vi.fn((value: number) => {
      readingStore.startPage.value = value
    }),
    setEndPage: vi.fn((value: number) => {
      readingStore.endPage.value = value
    }),
    startTimer: vi.fn(),
    pauseTimer,
    resetSession,
    hydrateFromCloud,
  }

  const notificationsStore = {
    success: notificationsSuccess,
    error: notificationsError,
    info: notificationsInfo,
  }

  return {
    enqueueOfflineFinishReadingSession,
    createSession,
    routerPush,
    ensureLibraryLoaded,
    updateBookMetadata,
    hydrateFromCloud,
    pauseTimer,
    resetSession,
    notificationsSuccess,
    notificationsError,
    routeQuery,
    authStore,
    booksStore,
    readingStore,
    notificationsStore,
  }
})

vi.mock('../../../services/offlineQueueService', () => ({
  enqueueOfflineFinishReadingSession: mocks.enqueueOfflineFinishReadingSession,
}))

vi.mock('../../../stores/sessions', () => ({
  useSessionsStore: () => ({
    createSession: mocks.createSession,
  }),
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => mocks.authStore,
}))

vi.mock('../../../stores/books', () => ({
  useBooksStore: () => mocks.booksStore,
}))

vi.mock('../../../stores/reading', () => ({
  useReadingStore: () => mocks.readingStore,
}))

vi.mock('../../../stores/notifications', () => ({
  useNotificationsStore: () => mocks.notificationsStore,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
  useRouter: () => ({ push: mocks.routerPush }),
}))

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, es },
  })
}

describe('ReadingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', { onLine: false })
    mocks.ensureLibraryLoaded.mockResolvedValue(undefined)
    mocks.updateBookMetadata.mockResolvedValue(undefined)
    mocks.hydrateFromCloud.mockResolvedValue(undefined)
    mocks.routerPush.mockResolvedValue(undefined)
    mocks.routeQuery.bookId = ''
    mocks.readingStore.selectedBookId.value = 'book-1'
    mocks.readingStore.sessionBookId.value = 'book-1'
    mocks.readingStore.startPage.value = 10
    mocks.readingStore.endPage.value = 10
    mocks.readingStore.elapsedSeconds.value = 120
    mocks.readingStore.running.value = true
    mocks.readingStore.hasActiveSession.value = true
    mocks.readingStore.sessionStartedAt.value = new Date('2026-03-04T12:00:00.000Z')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('queues finished reading session when offline', async () => {
    const wrapper = mount(ReadingView, {
      global: {
        plugins: [makeI18n()],
      },
    })
    await flushPromises()

    const finishButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Finish')
    if (!finishButton) {
      throw new Error('missing finish button')
    }
    await finishButton.trigger('click')
    await flushPromises()

    const numberInputs = wrapper.findAll('input[type="number"]')
    const endPageInput = numberInputs[numberInputs.length - 1]
    if (!endPageInput) {
      throw new Error('missing end page input')
    }
    await endPageInput.setValue('25')

    const confirmButton = wrapper
      .findAll('button')
      .find((button) => button.text().trim() === 'Confirm finish')
    if (!confirmButton) {
      throw new Error('missing confirm finish button')
    }
    await confirmButton.trigger('click')
    await flushPromises()

    expect(mocks.createSession).not.toHaveBeenCalled()
    expect(mocks.enqueueOfflineFinishReadingSession).toHaveBeenCalledTimes(1)
    expect(mocks.enqueueOfflineFinishReadingSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        bookId: 'book-1',
        startPage: 10,
        endPage: 25,
        pagesRead: 15,
        durationSeconds: 120,
        totalPages: 300,
        currentPage: 25,
        status: 'reading',
      }),
    )
    expect(mocks.updateBookMetadata).toHaveBeenCalledWith('book-1', {
      totalPages: 300,
      currentPage: 25,
      status: 'reading',
    })
    expect(mocks.pauseTimer).toHaveBeenCalled()
    expect(mocks.resetSession).toHaveBeenCalled()
    expect(mocks.notificationsSuccess).toHaveBeenCalledWith('Offline: session queued for sync.')
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'book-detail', params: { id: 'book-1' } })
  })

  it('keeps the visible selection tied to the active session book', async () => {
    mocks.routeQuery.bookId = 'book-2'
    mocks.readingStore.selectedBookId.value = 'book-2'
    mocks.readingStore.sessionBookId.value = 'book-1'

    mount(ReadingView, {
      global: {
        plugins: [makeI18n()],
      },
    })
    await flushPromises()

    expect(mocks.readingStore.setSelectedBook).toHaveBeenCalledWith('book-1')
    expect(mocks.readingStore.selectedBookId.value).toBe('book-1')
  })

  it('hides the book selector when opened from a book detail route', async () => {
    mocks.routeQuery.bookId = 'book-2'
    mocks.readingStore.selectedBookId.value = 'book-2'
    mocks.readingStore.hasActiveSession.value = false
    mocks.readingStore.sessionBookId.value = null
    mocks.readingStore.sessionStartedAt.value = null

    const wrapper = mount(ReadingView, {
      global: {
        plugins: [makeI18n()],
      },
    })
    await flushPromises()

    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('img[alt="Cuentos completos"]').attributes('src')).toBe('https://example.com/cuentos.jpg')
    expect(mocks.readingStore.setSelectedBook).toHaveBeenCalledWith('book-2')
  })

  it('opens the book detail when clicking the reading book card', async () => {
    const wrapper = mount(ReadingView, {
      global: {
        plugins: [makeI18n()],
      },
    })
    await flushPromises()

    const bookCard = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Deep Work') && button.text().includes('Cal Newport'))
    if (!bookCard) {
      throw new Error('missing reading book card')
    }

    await bookCard.trigger('click')

    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'book-detail', params: { id: 'book-1' } })
  })
})
