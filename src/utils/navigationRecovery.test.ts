import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'
import { installNavigationRecovery, isRecoverableRouteLoadError } from './navigationRecovery'
import { reloadAppOnce } from './reloadGuard'

vi.mock('./reloadGuard', () => ({
  reloadAppOnce: vi.fn(),
}))

describe('navigationRecovery', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('recognizes dynamic route import errors', () => {
    expect(isRecoverableRouteLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true)
    expect(isRecoverableRouteLoadError(new Error('ChunkLoadError: Loading chunk 4 failed'))).toBe(true)
    expect(isRecoverableRouteLoadError(new Error('Navigation aborted'))).toBe(false)
  })

  it('registers route and preload recovery handlers', () => {
    const routeErrorHandlers: Array<(error: Error) => void> = []
    const router = {
      onError: vi.fn((handler: (error: Error) => void) => {
        routeErrorHandlers.push(handler)
      }),
    } as unknown as Router

    installNavigationRecovery(router)
    expect(routeErrorHandlers).toHaveLength(1)
    routeErrorHandlers[0]?.(new Error('Failed to fetch dynamically imported module'))

    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)

    expect(router.onError).toHaveBeenCalledTimes(1)
    expect(reloadAppOnce).toHaveBeenCalledTimes(2)
    expect(event.defaultPrevented).toBe(true)
  })
})
