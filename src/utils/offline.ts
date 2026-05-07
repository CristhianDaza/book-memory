export function isOfflineQueueCandidate(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  const code = (candidate.code ?? '').toLowerCase()
  const message = (candidate.message ?? '').toLowerCase()
  return (
    code.includes('unavailable') ||
    code.includes('network') ||
    code.includes('timeout') ||
    code.includes('deadline-exceeded') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout')
  )
}

