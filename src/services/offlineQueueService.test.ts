import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueOfflineClearReadingState,
  enqueueOfflineSaveReadingState,
  getOfflineQueueCount,
  replayOfflineQueue,
} from './offlineQueueService'
import { clearReadingState, saveReadingState } from './readingStateService'

vi.mock('./readingStateService', () => ({
  saveReadingState: vi.fn(),
  clearReadingState: vi.fn(),
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
    vi.stubGlobal('localStorage', createStorageMock())
    vi.stubGlobal('navigator', { onLine: true })
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
})
