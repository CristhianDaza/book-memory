import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOfflineConflicts,
  enqueueOfflineFinishReadingSession,
  enqueueOfflineClearReadingState,
  enqueueOfflineSaveReadingState,
  enqueueOfflineStreakDay,
  getOfflineConflicts,
  getOfflineConflictCount,
  getOfflineQueueItems,
  getOfflineQueueCount,
  getRetryableOfflineConflictCount,
  removeOfflineConflict,
  removeOfflineQueueItem,
  requeueOfflineConflictById,
  requeueOfflineConflicts,
  replayOfflineQueue,
} from './offlineQueueService'
import { updateLibraryBookMetadata } from './libraryService'
import { createReadingSessionWithId } from './readingSessionService'
import { clearReadingState, saveReadingState } from './readingStateService'
import { markStreakDay } from './streakService'

vi.mock('./readingSessionService', () => ({
  createReadingSessionWithId: vi.fn(),
  deleteSessionsForBook: vi.fn(),
}))

vi.mock('./libraryService', () => ({
  addBookToLibrary: vi.fn(),
  deleteLibraryBook: vi.fn(),
  updateLibraryBookFavorite: vi.fn(),
  updateLibraryBookMetadata: vi.fn(),
}))

vi.mock('./readingStateService', () => ({
  saveReadingState: vi.fn(),
  clearReadingState: vi.fn(),
}))

vi.mock('./streakService', () => ({
  markStreakDay: vi.fn(),
}))

const STORAGE_KEY = 'book-memory-offline-queue'

function createStorageMock() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => {
      data.clear()
    },
  }
}

describe('offlineQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    vi.stubGlobal('localStorage', createStorageMock())
    vi.stubGlobal('navigator', { onLine: true })
    vi.mocked(createReadingSessionWithId).mockResolvedValue()
    vi.mocked(updateLibraryBookMetadata).mockResolvedValue()
    vi.mocked(markStreakDay).mockResolvedValue({
      created: true,
      record: {
        id: '2026-01-01',
        dayId: '2026-01-01',
        actions: ['reading_session_finished'],
        firstAction: 'reading_session_finished',
        lastAction: 'reading_session_finished',
        activityCount: 1,
      },
    })
    clearOfflineConflicts()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('queues save and replays it', async () => {
    enqueueOfflineSaveReadingState('u1', {
      selectedBookId: 'b1',
      sessionBookId: 'b1',
      startPage: 1,
      endPage: 5,
      elapsedSeconds: 10,
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      running: true,
      persistedAt: '2026-01-01T00:01:00.000Z',
    })

    await replayOfflineQueue()

    expect(saveReadingState).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]')
    expect(getOfflineQueueCount()).toBe(0)
  })

  it('keeps failed items for later replay', async () => {
    vi.mocked(clearReadingState).mockRejectedValueOnce(new Error('network'))
    enqueueOfflineClearReadingState('u1')

    await replayOfflineQueue()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw).toContain('clear_reading_state')
    expect(getOfflineQueueCount()).toBe(1)
  })

  it('compacts queue to latest action per user', async () => {
    enqueueOfflineSaveReadingState('u1', {
      selectedBookId: 'b1',
      sessionBookId: 'b1',
      startPage: 1,
      endPage: 2,
      elapsedSeconds: 3,
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      running: true,
      persistedAt: '2026-01-01T00:01:00.000Z',
    })
    enqueueOfflineSaveReadingState('u1', {
      selectedBookId: 'b2',
      sessionBookId: 'b2',
      startPage: 4,
      endPage: 5,
      elapsedSeconds: 6,
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      running: true,
      persistedAt: '2026-01-01T00:01:00.000Z',
    })

    expect(getOfflineQueueCount()).toBe(1)
    await replayOfflineQueue()
    expect(saveReadingState).toHaveBeenCalledTimes(1)
    const savedArg = vi.mocked(saveReadingState).mock.calls[0]?.[1]
    expect(savedArg?.selectedBookId).toBe('b2')
  })

  it('keeps clear as latest action over previous save for same user', async () => {
    enqueueOfflineSaveReadingState('u1', {
      selectedBookId: 'b1',
      sessionBookId: 'b1',
      startPage: 1,
      endPage: 2,
      elapsedSeconds: 3,
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      running: true,
      persistedAt: '2026-01-01T00:01:00.000Z',
    })
    enqueueOfflineClearReadingState('u1')

    expect(getOfflineQueueCount()).toBe(1)
    await replayOfflineQueue()
    expect(clearReadingState).toHaveBeenCalledTimes(1)
    expect(saveReadingState).toHaveBeenCalledTimes(0)
  })

  it('replays finish reading session transaction', async () => {
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-1',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })

    await replayOfflineQueue()

    expect(createReadingSessionWithId).toHaveBeenCalledWith(
      'u1',
      'offline-tx-1',
      expect.objectContaining({
        bookId: 'b1',
        pagesRead: 10,
      }),
    )
    expect(updateLibraryBookMetadata).toHaveBeenCalledWith('u1', 'b1', {
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })
    expect(getOfflineQueueCount()).toBe(0)
  })

  it('replays queued streak day updates', async () => {
    enqueueOfflineStreakDay('u1', {
      dayId: '2026-01-01',
      action: 'book_added',
    })

    await replayOfflineQueue()

    expect(markStreakDay).toHaveBeenCalledWith('u1', {
      dayId: '2026-01-01',
      action: 'book_added',
    })
    expect(getOfflineQueueCount()).toBe(0)
  })

  it('moves failed finish transaction to conflicts and removes from queue', async () => {
    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-conflict',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })

    await replayOfflineQueue()

    expect(getOfflineQueueCount()).toBe(0)
    expect(getOfflineConflictCount()).toBe(1)
    expect(getOfflineConflicts()[0]?.action).toBe('finish_reading_session')
    expect(getOfflineConflicts()[0]?.errorMessage).toBe('permission')
    expect(getOfflineConflicts()[0]?.retryCount).toBe(1)
    expect(getOfflineConflicts()[0]?.status).toBe('open')
    expect(getRetryableOfflineConflictCount()).toBe(0)
  })

  it('requeues conflicts back into queue and clears conflict list', async () => {
    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-requeue',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })
    await replayOfflineQueue()
    expect(getOfflineConflictCount()).toBe(1)

    vi.advanceTimersByTime(31_000)
    requeueOfflineConflicts()
    expect(getOfflineConflictCount()).toBe(1)
    expect(getOfflineConflicts()[0]?.status).toBe('retrying')
    expect(getOfflineQueueCount()).toBe(1)

    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    await replayOfflineQueue()
    expect(getOfflineConflictCount()).toBe(1)
    expect(getOfflineConflicts()[0]?.retryCount).toBe(2)
  })

  it('removes conflict when a requeued transaction succeeds', async () => {
    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-success-retry',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })
    await replayOfflineQueue()
    expect(getOfflineConflictCount()).toBe(1)

    vi.mocked(createReadingSessionWithId).mockResolvedValueOnce()
    vi.advanceTimersByTime(31_000)
    requeueOfflineConflicts()
    await replayOfflineQueue()
    expect(getOfflineConflictCount()).toBe(0)
  })

  it('requeues only conflicts whose retry window has elapsed', async () => {
    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-delay',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })
    await replayOfflineQueue()
    expect(getOfflineConflictCount()).toBe(1)
    expect(getRetryableOfflineConflictCount()).toBe(0)

    requeueOfflineConflicts()
    expect(getOfflineQueueCount()).toBe(0)

    vi.advanceTimersByTime(31_000)
    expect(getRetryableOfflineConflictCount()).toBe(1)
    requeueOfflineConflicts()
    expect(getOfflineQueueCount()).toBe(1)
  })

  it('removes queue item by id', async () => {
    enqueueOfflineSaveReadingState('u1', {
      selectedBookId: 'b1',
      sessionBookId: 'b1',
      startPage: 1,
      endPage: 2,
      elapsedSeconds: 3,
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      running: true,
      persistedAt: '2026-01-01T00:01:00.000Z',
    })
    enqueueOfflineSaveReadingState('u2', {
      selectedBookId: 'b2',
      sessionBookId: 'b2',
      startPage: 4,
      endPage: 5,
      elapsedSeconds: 6,
      sessionStartedAt: '2026-01-01T00:00:00.000Z',
      running: true,
      persistedAt: '2026-01-01T00:01:00.000Z',
    })

    const items = getOfflineQueueItems()
    expect(items).toHaveLength(2)
    const firstId = items[0]?.id
    const secondId = items[1]?.id
    if (!firstId || !secondId) {
      throw new Error('missing queued items')
    }
    removeOfflineQueueItem(firstId)

    expect(getOfflineQueueCount()).toBe(1)
    expect(getOfflineQueueItems()[0]?.id).toBe(secondId)
  })

  it('removes conflict by id', async () => {
    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-remove-conflict',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })
    await replayOfflineQueue()

    const conflictId = getOfflineConflicts()[0]?.id
    expect(conflictId).toBeTypeOf('string')
    removeOfflineConflict(conflictId as string)
    expect(getOfflineConflictCount()).toBe(0)
  })

  it('requeues a conflict by id and marks it retrying', async () => {
    vi.mocked(createReadingSessionWithId).mockRejectedValueOnce(new Error('permission'))
    enqueueOfflineFinishReadingSession('u1', {
      transactionId: 'tx-id-requeue',
      bookId: 'b1',
      startedAt: '2026-01-01T00:00:00.000Z',
      endedAt: '2026-01-01T00:10:00.000Z',
      durationSeconds: 600,
      startPage: 10,
      endPage: 20,
      pagesRead: 10,
      totalPages: 300,
      currentPage: 20,
      status: 'reading',
    })
    await replayOfflineQueue()
    expect(getOfflineConflictCount()).toBe(1)
    expect(getOfflineQueueCount()).toBe(0)

    const conflictId = getOfflineConflicts()[0]?.id as string
    requeueOfflineConflictById(conflictId, true)

    expect(getOfflineQueueCount()).toBe(1)
    expect(getOfflineConflicts()[0]?.status).toBe('retrying')
  })
})
