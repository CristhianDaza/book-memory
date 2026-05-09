import type { Router } from 'vue-router'
import { reloadAppOnce } from './reloadGuard'

type VitePreloadErrorEvent = Event & {
  payload?: unknown
}

const chunkErrorPattern =
  /(?:failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk \d+ failed|unable to preload css|error loading dynamically imported module)/i

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function isRecoverableRouteLoadError(error: unknown) {
  const message = errorToMessage(error)
  return chunkErrorPattern.test(message)
}

export function installNavigationRecovery(router: Router) {
  router.onError((error) => {
    if (isRecoverableRouteLoadError(error)) {
      reloadAppOnce()
    }
  })

  if (typeof window === 'undefined') return

  window.addEventListener('vite:preloadError', (event: VitePreloadErrorEvent) => {
    event.preventDefault()
    reloadAppOnce()
  })
}
