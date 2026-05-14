import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { useBooksStore } from './books'
import { useSessionsStore } from './sessions'
import { useStatsStore } from './stats'
import { fetchLibraryBooks } from '../services/libraryService'
import { fetchUserSessions } from '../services/readingSessionService'
import { fetchStatsGoals, saveStatsGoals } from '../services/statsGoalsService'
import { fetchStreakDays, markStreakDay } from '../services/streakService'
import { fetchReadingPlanDayRecords } from '../services/readingPlanHistoryService'

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

vi.mock('../services/statsGoalsService', () => ({
  fetchStatsGoals: vi.fn(),
  saveStatsGoals: vi.fn(),
}))

vi.mock('../services/streakService', () => ({
  fetchStreakDays: vi.fn(),
  markStreakDay: vi.fn(),
}))

vi.mock('../services/readingPlanHistoryService', () => ({
  fetchReadingPlanDayRecords: vi.fn(),
  toReadingPlanDayRecordId: (bookId: string, dayId: string) => `${bookId}_${dayId}`,
  upsertReadingPlanDayRecord: vi.fn(),
}))

vi.mock('../services/offlineQueueService', () => ({
  enqueueOfflineStreakDay: vi.fn(),
}))

describe('stats store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(fetchReadingPlanDayRecords).mockResolvedValue([])
    vi.mocked(fetchStreakDays).mockResolvedValue([])
    vi.mocked(markStreakDay).mockImplementation(async (_uid, payload) => ({
      created: true,
      record: {
        id: payload.dayId,
        dayId: payload.dayId,
        actions: [payload.action],
        firstAction: payload.action,
        lastAction: payload.action,
        activityCount: 1,
      },
    }))
  })

  it('builds top books and computes averages', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const books = useBooksStore()
    const sessions = useSessionsStore()
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
        rating: null,
        note: null,
        readingPlan: null,
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
        rating: null,
        note: null,
        readingPlan: null,
      },
    ])
    vi.mocked(fetchUserSessions).mockResolvedValue([
      { id: 's1', bookId: 'book-1', startedAt: now, pagesRead: 30, durationSeconds: 1800 },
      { id: 's2', bookId: 'book-1', startedAt: yesterday, pagesRead: 20, durationSeconds: 1200 },
      { id: 's3', bookId: 'book-2', startedAt: now, pagesRead: 10, durationSeconds: 600 },
    ] as never)
    vi.mocked(fetchStatsGoals).mockResolvedValue(null)

    await books.ensureLibraryLoaded()
    await sessions.ensureSessionsLoaded()
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
    const books = useBooksStore()
    const sessions = useSessionsStore()
    const now = new Date()
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)

    vi.mocked(fetchLibraryBooks).mockResolvedValue([])
    vi.mocked(fetchUserSessions).mockResolvedValue([
      { id: 's1', bookId: 'x', startedAt: now, pagesRead: 40, durationSeconds: 3600 },
      { id: 's2', bookId: 'x', startedAt: fortyDaysAgo, pagesRead: 5, durationSeconds: 300 },
    ] as never)
    vi.mocked(fetchStatsGoals).mockResolvedValue(null)
    vi.mocked(saveStatsGoals).mockResolvedValue()

    await books.ensureLibraryLoaded()
    await sessions.ensureSessionsLoaded()
    const store = useStatsStore()
    await store.loadStats()
    store.setWeeklyPagesGoal(20)
    store.setMonthlyMinutesGoal(30)

    expect(store.goalsProgress.weeklyPagesProgress).toBe(100)
    expect(store.goalsProgress.monthlyMinutesProgress).toBe(100)

    store.setRange('all')
    await store.loadStats()
    expect(store.activitySeries.length).toBeGreaterThan(30)
  })

  it('aggregates purchased and finished books by month and year', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const books = useBooksStore()
    const sessions = useSessionsStore()

    vi.mocked(fetchLibraryBooks).mockResolvedValue([
      {
        id: 'book-1',
        source: 'google',
        externalId: '1',
        title: 'Book One',
        authors: ['A'],
        coverUrl: null,
        totalPages: 100,
        favorite: false,
        currentPage: 100,
        status: 'finished',
        completedAt: { toDate: () => new Date('2026-02-01T12:00:00.000Z') },
        rating: null,
        note: null,
        readingPlan: null,
        createdAt: { toDate: () => new Date('2026-01-10T00:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-02-15T00:00:00.000Z') },
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
        currentPage: 20,
        status: 'reading',
        completedAt: null,
        rating: null,
        note: null,
        readingPlan: null,
        createdAt: { toDate: () => new Date('2026-02-02T00:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-02-20T00:00:00.000Z') },
      },
      {
        id: 'book-3',
        source: 'google',
        externalId: '3',
        title: 'Book Three',
        authors: ['C'],
        coverUrl: null,
        totalPages: 220,
        favorite: false,
        currentPage: 220,
        status: 'finished',
        completedAt: { toDate: () => new Date('2026-01-01T12:00:00.000Z') },
        rating: null,
        note: null,
        readingPlan: null,
        createdAt: { toDate: () => new Date('2025-12-28T00:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-01-03T00:00:00.000Z') },
      },
    ])
    vi.mocked(fetchUserSessions).mockResolvedValue([])
    vi.mocked(fetchStatsGoals).mockResolvedValue(null)

    await books.ensureLibraryLoaded()
    await sessions.ensureSessionsLoaded()
    const store = useStatsStore()
    await store.loadStats()

    expect(store.timelineYears).toEqual([2025, 2026])
    expect(store.selectedTimelineYear).toBe(2026)
    expect(store.timelineMonthlyBySelectedYear.map((entry) => entry.monthKey)).toEqual(['2026-01', '2026-02'])
    expect(store.timelineMonthlyBySelectedYear[0]).toMatchObject({
      purchasedCount: 1,
      finishedCount: 1,
    })
    expect(store.timelineMonthlyBySelectedYear[1]).toMatchObject({
      purchasedCount: 1,
      finishedCount: 1,
    })
    expect(store.selectedYearSummary).toMatchObject({
      year: 2026,
      purchasedCount: 2,
      finishedCount: 2,
    })
  })

  it('ignores invalid timeline dates and keeps chronological month ordering', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const books = useBooksStore()
    const sessions = useSessionsStore()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-05T00:00:00.000Z'))

    try {
      vi.mocked(fetchLibraryBooks).mockResolvedValue([
        {
          id: 'book-a',
          source: 'google',
          externalId: 'a',
          title: 'Book A',
          authors: ['A'],
          coverUrl: null,
          totalPages: 100,
          favorite: false,
          currentPage: 10,
          status: 'reading',
          completedAt: null,
          rating: null,
          note: null,
          readingPlan: null,
          createdAt: null,
          updatedAt: null,
        },
        {
          id: 'book-b',
          source: 'google',
          externalId: 'b',
          title: 'Book B',
          authors: ['B'],
          coverUrl: null,
          totalPages: 300,
          favorite: false,
          currentPage: 300,
          status: 'finished',
          completedAt: null,
          rating: null,
          note: null,
          readingPlan: null,
          createdAt: { toDate: () => new Date('2026-11-05T00:00:00.000Z') },
          updatedAt: null,
        },
        {
          id: 'book-c',
          source: 'google',
          externalId: 'c',
          title: 'Book C',
          authors: ['C'],
          coverUrl: null,
          totalPages: 250,
          favorite: false,
          currentPage: 250,
          status: 'finished',
          completedAt: { toDate: () => new Date('2026-02-10T00:00:00.000Z') },
          rating: null,
          note: null,
          readingPlan: null,
          createdAt: { toDate: () => new Date('2026-01-20T00:00:00.000Z') },
          updatedAt: { toDate: () => new Date('2026-02-10T00:00:00.000Z') },
        },
      ])
      vi.mocked(fetchUserSessions).mockResolvedValue([])
      vi.mocked(fetchStatsGoals).mockResolvedValue(null)

      await books.ensureLibraryLoaded()
      await sessions.ensureSessionsLoaded()
      const store = useStatsStore()
      await store.loadStats()
      store.setSelectedTimelineYear(2026)

      expect(store.timelineMonthlyBySelectedYear.map((entry) => entry.monthKey)).toEqual([
        '2026-01',
        '2026-02',
        '2026-11',
      ])
      expect(store.timelineMonthlyBySelectedYear.find((entry) => entry.monthKey === '2026-11')).toMatchObject({
        purchasedCount: 1,
        finishedCount: 1,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses completedAt first and falls back to updatedAt when missing', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const books = useBooksStore()
    const sessions = useSessionsStore()

    vi.mocked(fetchLibraryBooks).mockResolvedValue([
      {
        id: 'book-1',
        source: 'google',
        externalId: '1',
        title: 'Book One',
        authors: ['A'],
        coverUrl: null,
        totalPages: 100,
        favorite: false,
        currentPage: 100,
        status: 'finished',
        completedAt: { toDate: () => new Date('2026-01-04T12:00:00.000Z') },
        rating: null,
        note: null,
        readingPlan: null,
        createdAt: { toDate: () => new Date('2025-12-10T00:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-02-04T00:00:00.000Z') },
      },
      {
        id: 'book-2',
        source: 'google',
        externalId: '2',
        title: 'Book Two',
        authors: ['B'],
        coverUrl: null,
        totalPages: 120,
        favorite: false,
        currentPage: 120,
        status: 'finished',
        completedAt: null,
        rating: null,
        note: null,
        readingPlan: null,
        createdAt: { toDate: () => new Date('2026-01-10T00:00:00.000Z') },
        updatedAt: { toDate: () => new Date('2026-02-10T00:00:00.000Z') },
      },
    ])
    vi.mocked(fetchUserSessions).mockResolvedValue([])
    vi.mocked(fetchStatsGoals).mockResolvedValue(null)

    await books.ensureLibraryLoaded()
    await sessions.ensureSessionsLoaded()
    const store = useStatsStore()
    await store.loadStats()
    store.setSelectedTimelineYear(2026)

    const jan = store.timelineMonthlyBySelectedYear.find((entry) => entry.monthKey === '2026-01')
    const feb = store.timelineMonthlyBySelectedYear.find((entry) => entry.monthKey === '2026-02')
    expect(jan?.finishedCount).toBe(1)
    expect(feb?.finishedCount).toBe(1)
  })
})
