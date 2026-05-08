export async function initPwa() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  const { registerSW } = await import('virtual:pwa-register')
  let registration: ServiceWorkerRegistration | undefined
  const reloadGuardKey = 'bookmemory:pwa:reload-in-progress'
  const reloadGuardTtlMs = 30_000

  const canReloadNow = () => {
    const lastReloadAt = Number.parseInt(sessionStorage.getItem(reloadGuardKey) ?? '0', 10)
    return !Number.isFinite(lastReloadAt) || Date.now() - lastReloadAt > reloadGuardTtlMs
  }

  const reloadAppOnce = () => {
    if (!canReloadNow()) return
    sessionStorage.setItem(reloadGuardKey, String(Date.now()))
    window.location.reload()
  }

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_, reg) {
      registration = reg ?? undefined
    },
    onNeedRefresh() {
      void updateSW(true)
      reloadAppOnce()
    },
    onOfflineReady() {
      sessionStorage.removeItem(reloadGuardKey)
    },
  })

  window.addEventListener('online', () => {
    void updateSW(false)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void updateSW(false)
    }
  })

  window.setInterval(() => {
    void registration?.update()
  }, 60 * 60 * 1000)
}
