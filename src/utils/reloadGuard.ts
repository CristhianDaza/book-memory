const reloadGuardKey = 'bookmemory:reload-in-progress'
const defaultReloadGuardTtlMs = 30_000

interface ReloadOptions {
  ttlMs?: number
  force?: boolean
}

function getStoredReloadAt(storage: Storage): number {
  return Number.parseInt(storage.getItem(reloadGuardKey) ?? '0', 10)
}

export function canReloadApp(ttlMs = defaultReloadGuardTtlMs) {
  if (typeof window === 'undefined') return false

  const lastReloadAt = getStoredReloadAt(window.sessionStorage)
  return !Number.isFinite(lastReloadAt) || Date.now() - lastReloadAt > ttlMs
}

export function reloadAppOnce({ ttlMs = defaultReloadGuardTtlMs, force = false }: ReloadOptions = {}) {
  if (typeof window === 'undefined') return false
  if (!force && !canReloadApp(ttlMs)) return false

  window.sessionStorage.setItem(reloadGuardKey, String(Date.now()))
  window.location.reload()
  return true
}

export function clearReloadGuard() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(reloadGuardKey)
}
