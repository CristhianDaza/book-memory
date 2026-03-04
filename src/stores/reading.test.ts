import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth'
import { useReadingStore } from './reading'
import { clearReadingState, fetchReadingState, saveReadingState } from '../services/readingStateService'

vi.mock('../i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('../services/readingStateService', () => ({
  fetchReadingState: vi.fn(),
  saveReadingState: vi.fn(),
  clearReadingState: vi.fn(),
}))

const STORAGE_KEY = 'book-memory-reading-session'

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

describe('reading store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', createStorageMock())
    vi.mocked(fetchReadingState).mockResolvedValue(null)
    vi.mocked(saveReadingState).mockResolvedValue()
    vi.mocked(clearReadingState).mockResolvedValue()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts and increments timer while running', () => {
    const store = useReadingStore()

    store.startTimer()
    vi.advanceTimersByTime(3000)

    expect(store.running).toBe(true)
    expect(store.elapsedSeconds).toBe(3)
    expect(store.hasActiveSession).toBe(true)
  })

  it('pauses timer and stops increments', () => {
    const store = useReadingStore()

    store.startTimer()
    vi.advanceTimersByTime(2000)
    store.pauseTimer()
    vi.advanceTimersByTime(2000)

    expect(store.running).toBe(false)
    expect(store.elapsedSeconds).toBe(2)
  })

  it('resets session values', () => {
    const store = useReadingStore()

    store.setStartPage(12)
    store.setEndPage(20)
    store.startTimer()
    vi.advanceTimersByTime(1000)
    store.resetSession()

    expect(store.startPage).toBe(0)
    expect(store.endPage).toBe(0)
    expect(store.elapsedSeconds).toBe(0)
    expect(store.sessionStartedAt).toBe(null)
    expect(store.running).toBe(false)
  })

  it('restores persisted active session and keeps timer running', () => {
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'))
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedBookId: 'book-1',
        sessionBookId: 'book-1',
        startPage: 15,
        endPage: 15,
        elapsedSeconds: 120,
        sessionStartedAt: '2026-03-01T09:58:00.000Z',
        running: true,
        persistedAt: '2026-03-01T09:59:30.000Z',
      }),
    )

    const store = useReadingStore()
    expect(store.selectedBookId).toBe('book-1')
    expect(store.sessionBookId).toBe('book-1')
    expect(store.hasActiveSession).toBe(true)
    expect(store.running).toBe(true)
    expect(store.elapsedSeconds).toBe(150)

    vi.advanceTimersByTime(2000)
    expect(store.elapsedSeconds).toBe(152)
  })

  it('syncs active session to cloud when authenticated', async () => {
    const auth = useAuthStore()
    auth.user = { uid: 'user-1' } as never
    const store = useReadingStore()

    store.setSelectedBook('book-cloud')
    store.setStartPage(10)
    store.startTimer()
    vi.advanceTimersByTime(700)

    expect(saveReadingState).toHaveBeenCalled()
  })
})
