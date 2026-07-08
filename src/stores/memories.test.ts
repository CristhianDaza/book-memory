import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { useMemoriesStore } from './memories'
import { createMemory, deleteMemory, fetchMemories, updateMemory } from '../services/memoryService'

vi.mock('../services/memoryService', () => ({
  fetchMemories: vi.fn(),
  createMemory: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
}))

describe('memories store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates memories with normalized tags and exposes due items', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    vi.mocked(createMemory).mockResolvedValue({
      id: 'memory-1',
      bookId: 'book-1',
      kind: 'idea',
      content: 'A useful idea',
      page: 12,
      tags: ['habits', 'focus'],
      favorite: true,
      reviewStatus: 'pending',
      nextReviewAt: tomorrow,
    })

    const store = useMemoriesStore()
    await store.addMemory({
      bookId: 'book-1',
      kind: 'idea',
      content: ' A useful idea ',
      page: 12,
      tags: [' Habits ', 'focus', 'habits'],
      favorite: true,
    })

    expect(createMemory).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        content: 'A useful idea',
        tags: ['habits', 'focus'],
      }),
    )
    expect(store.memories).toHaveLength(1)
    expect(store.dueMemories).toHaveLength(0)
  })

  it('filters by query, book, kind, tag, favorite, and due status', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    vi.mocked(fetchMemories).mockResolvedValue([
      {
        id: 'memory-1',
        bookId: 'book-1',
        kind: 'quote',
        content: 'Remember this sentence',
        page: 3,
        tags: ['craft'],
        favorite: true,
        reviewStatus: 'pending',
        nextReviewAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: 'memory-2',
        bookId: 'book-2',
        kind: 'summary',
        content: 'Different note',
        page: null,
        tags: ['history'],
        favorite: false,
        reviewStatus: 'reviewed',
        nextReviewAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    ])

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-07T00:00:00.000Z'))
    try {
      const store = useMemoriesStore()
      await store.ensureMemoriesLoaded()
      store.setFilters({
        searchQuery: 'sentence',
        selectedBookId: 'book-1',
        selectedKind: 'quote',
        selectedTag: 'craft',
        showOnlyFavorites: true,
        showOnlyDue: true,
      })

      expect(store.filteredMemories.map((memory) => memory.id)).toEqual(['memory-1'])
      expect(store.allTags).toEqual(['craft', 'history'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('marks review outcomes using the expected service payloads', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useMemoriesStore()
    store.memories = [
      {
        id: 'memory-1',
        bookId: 'book-1',
        kind: 'question',
        content: 'Why?',
        page: null,
        tags: [],
        favorite: false,
        reviewStatus: 'pending',
        nextReviewAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]

    await store.markRemembered('memory-1')
    expect(updateMemory).toHaveBeenCalledWith(
      'user-1',
      'memory-1',
      expect.objectContaining({ reviewStatus: 'reviewed', nextReviewAt: expect.any(Date) }),
    )

    await store.removeMemory('memory-1')
    expect(deleteMemory).toHaveBeenCalledWith('user-1', 'memory-1')
  })
})

