import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { useStatsStore } from './stats'
import { fetchLibraryBooks } from '../services/libraryService'
import { fetchUserSessions } from '../services/readingSessionService'

vi.mock('../i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('../services/libraryService', () => ({
  fetchLibraryBooks: vi.fn(),
}))

vi.mock('../services/readingSessionService', () => ({
  fetchUserSessions: vi.fn(),
}))

describe('stats store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('builds top books and computes averages', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    vi.mocked(fetchLibraryBooks).mockResolvedValue([
      {
        id: 'book-1',
        source: 'google',
        externalId: '1',
        title: 'Book One',
        authors: ['A'],
        coverUrl: null,
        totalPages: 300,
        favorite: false,
        currentPage: 20,
        status: 'reading',
      },
      {
        id: 'book-2',
        source: 'google',
        externalId: '2',
        title: 'Book Two',
        authors: ['B'],
        coverUrl: null,
        totalPages: 200,
        favorite: false,
        currentPage: 40,
        status: 'reading',
      },
    ])
    vi.mocked(fetchUserSessions).mockResolvedValue([
      { id: 's1', bookId: 'book-1', startedAt: now, pagesRead: 30, durationSeconds: 1800 },
      { id: 's2', bookId: 'book-1', startedAt: yesterday, pagesRead: 20, durationSeconds: 1200 },
      { id: 's3', bookId: 'book-2', startedAt: now, pagesRead: 10, durationSeconds: 600 },
    ] as never)

    const store = useStatsStore()
    await store.loadStats()

    expect(store.topBooks[0]?.bookId).toBe('book-1')
    expect(store.topBooks[0]?.totalPages).toBe(50)
    expect(store.topBooks[0]?.avgPagesPerSession).toBe(25)
    expect(store.topBooks[0]?.avgMinutesPerSession).toBe(25)
  })

  it('updates goals progress and supports all range activity history', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const now = new Date()
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

    vi.mocked(fetchLibraryBooks).mockResolvedValue([])
    vi.mocked(fetchUserSessions).mockResolvedValue([
      { id: 's1', bookId: 'x', startedAt: now, pagesRead: 40, durationSeconds: 3600 },
      { id: 's2', bookId: 'x', startedAt: fortyDaysAgo, pagesRead: 5, durationSeconds: 300 },
    ] as never)

    const store = useStatsStore()
    await store.loadStats()
    store.setWeeklyPagesGoal(20)
    store.setMonthlyMinutesGoal(30)

    expect(store.goalsProgress.weeklyPagesProgress).toBe(100)
    expect(store.goalsProgress.monthlyMinutesProgress).toBe(100)

    store.setRange('all')
    expect(store.activitySeries.length).toBeGreaterThan(30)
  })
})
