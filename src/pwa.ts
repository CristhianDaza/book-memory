export async function initPwa() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (!import.meta.env.PROD) return

  const { registerSW } = await import('virtual:pwa-register')
  let registration: ServiceWorkerRegistration | undefined

  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_, reg) {
      registration = reg ?? undefined
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
