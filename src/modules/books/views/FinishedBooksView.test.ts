import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FinishedBooksView from './FinishedBooksView.vue'
import type { LibraryBook } from '../../../types/books'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'
import { fetchLibraryBooks } from '../../../services/libraryService'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
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

const finishedBook: LibraryBook = {
  id: 'finished-1',
  source: 'google',
  externalId: 'finished-1',
  title: 'Finished One',
  authors: ['Author A'],
  coverUrl: null,
  totalPages: 230,
  favorite: false,
  currentPage: 230,
  status: 'finished',
  rating: 4,
  note: null,
  completedAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
}

const abandonedBook: LibraryBook = {
  id: 'abandoned-1',
  source: 'google',
  externalId: 'abandoned-1',
  title: 'Abandoned One',
  authors: ['Author B'],
  coverUrl: null,
  totalPages: 280,
  favorite: false,
  currentPage: 120,
  status: 'abandoned',
  rating: 2,
  note: 'Maybe later',
  abandonedReason: 'Too dense',
  updatedAt: '2026-04-01T00:00:00.000Z',
}

const readingBook: LibraryBook = {
  id: 'reading-1',
  source: 'google',
  externalId: 'reading-1',
  title: 'Reading One',
  authors: ['Author C'],
  coverUrl: null,
  totalPages: 350,
  favorite: false,
  currentPage: 75,
  status: 'reading',
  rating: null,
  note: null,
}

function mountView() {
  setActivePinia(createPinia())
  const authStore = useAuthStore()
  authStore.user = { uid: 'user-1' } as never
  authStore.initialized = true
  const booksStore = useBooksStore()
  booksStore.library = [finishedBook, abandonedBook, readingBook]

  return mount(FinishedBooksView, {
    global: {
      stubs: {
        PageHeader: {
          template: '<header><slot /></header>',
        },
        SurfaceCard: {
          template: '<section><slot /></section>',
        },
        EmptyState: {
          props: {
            title: {
              type: String,
              default: '',
            },
            description: {
              type: String,
              default: '',
            },
          },
          template: '<div><p>{{ title }}</p><p>{{ description }}</p><slot /></div>',
        },
        RouterLink: {
          props: {
            to: {
              type: [String, Object],
              default: '',
            },
          },
          template: '<a href="#"><slot /></a>',
        },
        StarRating: {
          template: '<div class="star-rating-stub" />',
        },
      },
    },
  })
}

describe('FinishedBooksView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchLibraryBooks).mockResolvedValue([finishedBook, abandonedBook, readingBook])
  })

  it('renders finished and abandoned sections with proper book filtering', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('books.abandonedRetryTitle')
    expect(wrapper.text()).toContain('Finished One')
    expect(wrapper.text()).toContain('Abandoned One')
    expect(wrapper.text()).not.toContain('Reading One')
    expect(wrapper.text()).toContain('Too dense')
  })

  it('moves abandoned book to wishlist when retry action is clicked', async () => {
    const wrapper = mountView()
    const booksStore = useBooksStore()
    const notificationsStore = useNotificationsStore()
    const updateSpy = vi.spyOn(booksStore, 'updateBookMetadata').mockResolvedValue()
    const successSpy = vi.spyOn(notificationsStore, 'success')
    const errorSpy = vi.spyOn(notificationsStore, 'error')

    await flushPromises()
    const retryButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('books.retryAbandonedAction'))

    expect(retryButton).toBeTruthy()
    await retryButton?.trigger('click')
    await flushPromises()

    expect(updateSpy).toHaveBeenCalledWith('abandoned-1', {
      coverUrl: null,
      totalPages: 280,
      currentPage: 120,
      status: 'wishlist',
      rating: 2,
      note: 'Maybe later',
      abandonedReason: null,
    })
    expect(successSpy).toHaveBeenCalledWith('notifications.abandonedBookRetried')
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
