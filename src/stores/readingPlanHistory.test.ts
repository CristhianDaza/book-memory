import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueOfflineReadingPlanDayUpdate } from '../services/offlineQueueService'
import { fetchReadingPlanDayRecords, upsertReadingPlanDayRecord } from '../services/readingPlanHistoryService'
import type { LibraryBook } from '../types/books'
import { useAuthStore } from './auth'
import { useReadingPlanHistoryStore } from './readingPlanHistory'

vi.mock('../services/readingPlanHistoryService', () => ({
  fetchReadingPlanDayRecords: vi.fn(),
  toReadingPlanDayRecordId: (bookId: string, dayId: string) => `${bookId}_${dayId}`,
  upsertReadingPlanDayRecord: vi.fn(),
}))

vi.mock('../services/offlineQueueService', () => ({
  enqueueOfflineReadingPlanDayUpdate: vi.fn(),
}))

function plannedBook(overrides: Partial<LibraryBook> = {}): LibraryBook {
  return {
    id: 'book-1',
    source: 'manual',
    externalId: 'book-1',
    title: 'Book',
    authors: ['Author'],
    coverUrl: null,
    totalPages: 100,
    favorite: false,
    currentPage: 20,
    status: 'reading',
    rating: null,
    note: null,
    readingPlan: {
      targetDate: null,
      dailyPagesGoal: 10,
      reminderEnabled: false,
      reminderTime: null,
      reminderDays: null,
      startDate: '2026-05-13',
      startPage: 20,
    },
    ...overrides,
  }
}

describe('reading plan history store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(fetchReadingPlanDayRecords).mockResolvedValue([])
    vi.mocked(upsertReadingPlanDayRecord).mockImplementation(async (_uid, payload) => ({
      id: `${payload.bookId}_${payload.dayId}`,
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  })

  it('loads records for the authenticated user', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    vi.mocked(fetchReadingPlanDayRecords).mockResolvedValue([
      {
        id: 'book-1_2026-05-13',
        bookId: 'book-1',
        dayId: '2026-05-13',
        targetPages: 10,
        actualPages: 10,
        metGoal: true,
      },
    ])

    const store = useReadingPlanHistoryStore()
    await store.ensureHistoryLoaded()

    expect(fetchReadingPlanDayRecords).toHaveBeenCalledWith('user-1')
    expect(store.totalRecords).toBe(1)
  })

  it('upserts a compliance day from sessions', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useReadingPlanHistoryStore()

    await store.syncBookDay(
      plannedBook(),
      [{ id: 's1', bookId: 'book-1', startedAt: new Date('2026-05-13T10:00:00'), pagesRead: 12 }],
      new Date('2026-05-13T12:00:00'),
    )

    expect(upsertReadingPlanDayRecord).toHaveBeenCalledWith('user-1', {
      bookId: 'book-1',
      dayId: '2026-05-13',
      targetPages: 10,
      actualPages: 12,
      metGoal: true,
    })
    expect(store.getRecordsForBook('book-1')[0]?.metGoal).toBe(true)
  })

  it('queues a compliance day when persistence fails offline', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    vi.mocked(upsertReadingPlanDayRecord).mockRejectedValue(new Error('network timeout'))
    const store = useReadingPlanHistoryStore()

    await store.syncBookDay(
      plannedBook(),
      [{ id: 's1', bookId: 'book-1', startedAt: new Date('2026-05-13T10:00:00'), pagesRead: 5 }],
      new Date('2026-05-13T12:00:00'),
    )

    expect(enqueueOfflineReadingPlanDayUpdate).toHaveBeenCalledWith('user-1', {
      bookId: 'book-1',
      dayId: '2026-05-13',
      targetPages: 10,
      actualPages: 5,
      metGoal: false,
    })
  })
})
