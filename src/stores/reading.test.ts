import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReadingStore } from './reading'

describe('reading store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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
})
