import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MemoriesView from './MemoriesView.vue'
import { useAuthStore } from '../../../stores/auth'
import { createMemory, fetchMemories, updateMemory } from '../../../services/memoryService'
import { fetchLibraryBooks } from '../../../services/libraryService'

vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: {
      t: (key: string) => key,
    },
  }),
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    locale: { value: 'en' },
  }),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a href="#"><slot /></a>',
  },
}))

vi.mock('../../../services/libraryService', () => ({
  fetchLibraryBooks: vi.fn(),
}))

vi.mock('../../../services/memoryService', () => ({
  fetchMemories: vi.fn(),
  createMemory: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
}))

vi.mock('../../../services/readingSessionService', () => ({
  deleteSessionsForBook: vi.fn(),
}))

vi.mock('../../../services/offlineQueueService', () => ({
  enqueueOfflineLibraryAddBook: vi.fn(),
  enqueueOfflineLibraryDeleteBook: vi.fn(),
  enqueueOfflineLibraryUpdateFavorite: vi.fn(),
  enqueueOfflineLibraryUpdateMetadata: vi.fn(),
}))

function mountView() {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = { uid: 'user-1' } as never
  auth.initialized = true
  return mount(MemoriesView, {
    global: {
      stubs: {
        PageHeader: {
          template: '<header><slot name="actions" /></header>',
        },
        SurfaceCard: {
          template: '<section><slot /></section>',
        },
        EmptyState: {
          props: ['title', 'description'],
          template: '<section><p>{{ title }}</p><p>{{ description }}</p><slot /></section>',
        },
        RouterLink: {
          props: ['to'],
          template: '<a href="#"><slot /></a>',
        },
      },
    },
  })
}

describe('MemoriesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchLibraryBooks).mockResolvedValue([
      {
        id: 'book-1',
        source: 'google',
        externalId: '1',
        title: 'Memory Book',
        authors: ['A'],
        coverUrl: null,
        totalPages: 100,
        favorite: false,
        currentPage: 10,
        status: 'reading',
        rating: null,
        note: null,
        readingPlan: null,
      },
    ])
  })

  it('creates a memory from the quick form', async () => {
    vi.mocked(fetchMemories).mockResolvedValue([])
    vi.mocked(createMemory).mockResolvedValue({
      id: 'memory-1',
      bookId: 'book-1',
      kind: 'idea',
      content: 'Fresh idea',
      page: null,
      tags: [],
      favorite: false,
      reviewStatus: 'pending',
      nextReviewAt: new Date(),
    })
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('textarea').setValue('Fresh idea')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(createMemory).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        bookId: 'book-1',
        content: 'Fresh idea',
      }),
    )
    expect(wrapper.text()).toContain('Fresh idea')
  })

  it('shows empty state when filters have no matches', async () => {
    vi.mocked(fetchMemories).mockResolvedValue([])
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('memories.emptyTitle')
  })

  it('marks a due memory as remembered', async () => {
    vi.mocked(fetchMemories).mockResolvedValue([
      {
        id: 'memory-1',
        bookId: 'book-1',
        kind: 'quote',
        content: 'A quote to review',
        page: 8,
        tags: ['craft'],
        favorite: false,
        reviewStatus: 'pending',
        nextReviewAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ])
    const wrapper = mountView()
    await flushPromises()

    const remembered = wrapper.findAll('button').find((button) => button.text().includes('memories.remembered'))
    expect(remembered).toBeTruthy()
    await remembered?.trigger('click')
    await flushPromises()

    expect(updateMemory).toHaveBeenCalledWith(
      'user-1',
      'memory-1',
      expect.objectContaining({ reviewStatus: 'reviewed', nextReviewAt: expect.any(Date) }),
    )
  })
})
