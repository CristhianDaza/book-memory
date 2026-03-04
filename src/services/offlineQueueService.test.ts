import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enqueueOfflineClearReadingState,
  enqueueOfflineSaveReadingState,
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
  })

  it('keeps failed items for later replay', async () => {
    vi.mocked(clearReadingState).mockRejectedValueOnce(new Error('network'))
    enqueueOfflineClearReadingState('u1')

    await replayOfflineQueue()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(raw).toContain('clear_reading_state')
  })
})

