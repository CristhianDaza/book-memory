import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { useStreakStore } from './streak'
import { fetchStreakDays, markStreakDay } from '../services/streakService'

vi.mock('../services/streakService', () => ({
  fetchStreakDays: vi.fn(),
  markStreakDay: vi.fn(),
}))

vi.mock('../services/offlineQueueService', () => ({
  enqueueOfflineStreakDay: vi.fn(),
}))

describe('streak store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-05T15:00:00.000Z'))
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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts a single day once even with multiple actions', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useStreakStore()

    const firstCreated = await store.markTodayActivity('book_added')
    const secondCreated = await store.markTodayActivity('status_changed')

    expect(firstCreated).toBe(true)
    expect(secondCreated).toBe(false)
    expect(store.currentStreakDays).toBe(1)
    expect(store.bestStreakDays).toBe(1)
    expect(store.days).toHaveLength(1)
    expect(store.days[0]?.actions).toEqual(['book_added', 'status_changed'])
  })

  it('keeps continuity for yesterday and today', () => {
    const store = useStreakStore()

    store.days = [
      {
        id: '2026-05-05',
        dayId: '2026-05-05',
        actions: ['book_added'],
        firstAction: 'book_added',
        lastAction: 'book_added',
        activityCount: 1,
      },
      {
        id: '2026-05-04',
        dayId: '2026-05-04',
        actions: ['reading_session_finished'],
        firstAction: 'reading_session_finished',
        lastAction: 'reading_session_finished',
        activityCount: 1,
      },
    ]

    expect(store.currentStreakDays).toBe(2)
    expect(store.bestStreakDays).toBe(2)
  })

  it('breaks the current streak after a missing day', () => {
    const store = useStreakStore()

    store.days = [
      {
        id: '2026-05-03',
        dayId: '2026-05-03',
        actions: ['book_added'],
        firstAction: 'book_added',
        lastAction: 'book_added',
        activityCount: 1,
      },
    ]

    expect(store.currentStreakDays).toBe(0)
    expect(store.bestStreakDays).toBe(1)
  })

  it('computes the best historical streak across gaps', () => {
    const store = useStreakStore()

    store.days = ['2026-05-05', '2026-05-04', '2026-05-02', '2026-05-01', '2026-04-30'].map((dayId) => ({
      id: dayId,
      dayId,
      actions: ['book_added' as const],
      firstAction: 'book_added' as const,
      lastAction: 'book_added' as const,
      activityCount: 1,
    }))

    expect(store.currentStreakDays).toBe(2)
    expect(store.bestStreakDays).toBe(3)
  })

  it('migrates unique historical session days', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useStreakStore()

    await store.migrateFromSessions([
      { id: 's1', bookId: 'b1', startedAt: new Date('2026-05-01T10:00:00') },
      { id: 's2', bookId: 'b1', startedAt: new Date('2026-05-01T11:00:00') },
      { id: 's3', bookId: 'b2', startedAt: new Date('2026-05-02T11:00:00') },
    ] as never)

    expect(markStreakDay).toHaveBeenCalledTimes(2)
    expect(markStreakDay).toHaveBeenCalledWith('user-1', {
      dayId: '2026-05-01',
      action: 'reading_session_finished',
    })
    expect(markStreakDay).toHaveBeenCalledWith('user-1', {
      dayId: '2026-05-02',
      action: 'reading_session_finished',
    })
    expect(store.days.map((day) => day.dayId).sort()).toEqual(['2026-05-01', '2026-05-02'])
  })
})
