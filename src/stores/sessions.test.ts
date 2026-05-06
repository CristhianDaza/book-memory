import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { useSessionsStore } from './sessions'
import { createReadingSession, fetchUserSessions } from '../services/readingSessionService'

vi.mock('../services/readingSessionService', () => ({
  createReadingSession: vi.fn(),
  deleteReadingSession: vi.fn(),
  fetchUserSessions: vi.fn(),
  updateReadingSession: vi.fn(),
}))

const streakMocks = vi.hoisted(() => ({
  markTodayActivity: vi.fn(),
}))

vi.mock('./streak', () => ({
  useStreakStore: () => ({
    markTodayActivity: streakMocks.markTodayActivity,
  }),
}))

describe('sessions store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(createReadingSession).mockResolvedValue()
    vi.mocked(fetchUserSessions).mockResolvedValue([])
    streakMocks.markTodayActivity.mockResolvedValue(false)
  })

  it('marks streak activity after creating a reading session', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useSessionsStore()
    const payload = {
      bookId: 'book-1',
      startedAt: new Date('2026-05-05T10:00:00'),
      endedAt: new Date('2026-05-05T10:30:00'),
      durationSeconds: 1800,
      startPage: 10,
      endPage: 30,
      pagesRead: 20,
    }

    await store.createSession(payload)

    expect(createReadingSession).toHaveBeenCalledWith('user-1', payload)
    expect(streakMocks.markTodayActivity).toHaveBeenCalledWith('reading_session_finished')
  })
})
