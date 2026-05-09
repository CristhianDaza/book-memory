import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canReloadApp, clearReloadGuard, reloadAppOnce } from './reloadGuard'

describe('reloadGuard', () => {
  let reloadSpy: ReturnType<typeof vi.fn>
  let originalLocation: Location

  beforeEach(() => {
    reloadSpy = vi.fn()
    originalLocation = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        reload: reloadSpy,
      },
    })
    window.sessionStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    window.sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('reloads only once while the guard is active', () => {
    expect(canReloadApp()).toBe(true)

    expect(reloadAppOnce()).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
    expect(canReloadApp()).toBe(false)

    expect(reloadAppOnce()).toBe(false)
    expect(reloadSpy).toHaveBeenCalledTimes(1)
  })

  it('allows another reload after the guard is cleared', () => {
    expect(reloadAppOnce()).toBe(true)

    clearReloadGuard()

    expect(reloadAppOnce()).toBe(true)
    expect(reloadSpy).toHaveBeenCalledTimes(2)
  })
})
