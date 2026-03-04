import { clearReadingState, saveReadingState } from './readingStateService'
import type { OfflineQueueItem, QueuedReadingStatePayload } from '../types/offline-queue'

const STORAGE_KEY = 'book-memory-offline-queue'
const QUEUE_EVENT = 'book-memory-offline-queue-changed'
const MAX_QUEUE_ITEMS = 200
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
  const compacted = compactQueue(items)
  const bounded =
    compacted.length > MAX_QUEUE_ITEMS ? compacted.slice(compacted.length - MAX_QUEUE_ITEMS) : compacted
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounded))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_EVENT))
  }
}

function compactQueue(items: OfflineQueueItem[]): OfflineQueueItem[] {
  const lastIndexByUid = new Map<string, number>()
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item) continue
    lastIndexByUid.set(item.uid, index)
  }
  return Array.from(lastIndexByUid.entries())
    .sort((a, b) => a[1] - b[1])
    .map((entry) => items[entry[1]])
    .filter((item): item is OfflineQueueItem => Boolean(item))
}

export function getOfflineQueueCount(): number {
  return readQueue().length
}

export function onOfflineQueueChange(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const wrapped = () => listener()
  window.addEventListener(QUEUE_EVENT, wrapped)
  return () => {
    window.removeEventListener(QUEUE_EVENT, wrapped)
  }
}

export function enqueueOfflineSaveReadingState(uid: string, payload: QueuedReadingStatePayload) {
  const items = compactQueue(readQueue())
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
  const items = compactQueue(readQueue())
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
    const items = compactQueue(readQueue())
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
