import { clearReadingState, saveReadingState } from './readingStateService'
import type { OfflineQueueItem, QueuedReadingStatePayload } from '../types/offline-queue'

const STORAGE_KEY = 'book-memory-offline-queue'
let replaying = false

function canUseStorage(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
}

function readQueue(): OfflineQueueItem[] {
  if (!canUseStorage()) return []
  const raw = globalThis.localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as OfflineQueueItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeQueue(items: OfflineQueueItem[]) {
  if (!canUseStorage()) return
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function enqueueOfflineSaveReadingState(uid: string, payload: QueuedReadingStatePayload) {
  const items = readQueue()
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    action: 'save_reading_state',
    uid,
    payload,
    createdAt: new Date().toISOString(),
  })
  writeQueue(items)
}

export function enqueueOfflineClearReadingState(uid: string) {
  const items = readQueue()
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    action: 'clear_reading_state',
    uid,
    payload: null,
    createdAt: new Date().toISOString(),
  })
  writeQueue(items)
}

export async function replayOfflineQueue() {
  if (replaying) return
  replaying = true
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const items = readQueue()
    if (items.length === 0) return

    const pending: OfflineQueueItem[] = []

    for (const item of items) {
      try {
        if (item.action === 'save_reading_state' && item.payload) {
          await saveReadingState(item.uid, {
            selectedBookId: item.payload.selectedBookId,
            sessionBookId: item.payload.sessionBookId,
            startPage: item.payload.startPage,
            endPage: item.payload.endPage,
            elapsedSeconds: item.payload.elapsedSeconds,
            sessionStartedAt: item.payload.sessionStartedAt ? new Date(item.payload.sessionStartedAt) : null,
            running: item.payload.running,
            persistedAt: new Date(item.payload.persistedAt),
          })
        }
        if (item.action === 'clear_reading_state') {
          await clearReadingState(item.uid)
        }
      } catch {
        pending.push(item)
      }
    }

    writeQueue(pending)
  } finally {
    replaying = false
  }
}

export function initOfflineQueueReplay() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', () => {
    void replayOfflineQueue()
  })
  void replayOfflineQueue()
}

