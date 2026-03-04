import { updateLibraryBookMetadata } from './libraryService'
import { createReadingSessionWithId } from './readingSessionService'
import { clearReadingState, saveReadingState } from './readingStateService'
import type {
  OfflineConflictItem,
  OfflineQueueItem,
  QueuedFinishSessionPayload,
  QueuedReadingStatePayload,
} from '../types/offline-queue'

const STORAGE_KEY = 'book-memory-offline-queue'
const CONFLICTS_KEY = 'book-memory-offline-conflicts'
const QUEUE_EVENT = 'book-memory-offline-queue-changed'
const MAX_QUEUE_ITEMS = 200
const MAX_CONFLICT_ITEMS = 100
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

function readConflicts(): OfflineConflictItem[] {
  if (!canUseStorage()) return []
  const raw = globalThis.localStorage.getItem(CONFLICTS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as OfflineConflictItem[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeConflicts(items: OfflineConflictItem[]) {
  if (!canUseStorage()) return
  const bounded = items.length > MAX_CONFLICT_ITEMS ? items.slice(items.length - MAX_CONFLICT_ITEMS) : items
  globalThis.localStorage.setItem(CONFLICTS_KEY, JSON.stringify(bounded))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(QUEUE_EVENT))
  }
}

function appendConflict(item: OfflineQueueItem) {
  const conflicts = readConflicts()
  const conflictId =
    item.action === 'finish_reading_session' &&
    item.payload &&
    typeof (item.payload as QueuedFinishSessionPayload).transactionId === 'string'
      ? `finish:${(item.payload as QueuedFinishSessionPayload).transactionId}`
      : `${item.action}:${item.id}`

  const filtered = conflicts.filter((entry) => entry.id !== conflictId)
  filtered.push({
    id: conflictId,
    action: item.action,
    uid: item.uid,
    payload: item.payload,
    createdAt: item.createdAt,
    failedAt: new Date().toISOString(),
  })
  writeConflicts(filtered)
}

function compactQueue(items: OfflineQueueItem[]): OfflineQueueItem[] {
  const lastIndexByUid = new Map<string, number>()
  const keepIndexes: number[] = []
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]
    if (!item) continue
    if (item.action === 'save_reading_state' || item.action === 'clear_reading_state') {
      lastIndexByUid.set(item.uid, index)
      continue
    }
    keepIndexes.push(index)
  }
  const stateIndexes = Array.from(lastIndexByUid.values())
  return [...keepIndexes, ...stateIndexes]
    .sort((a, b) => a - b)
    .map((index) => items[index])
    .filter((item): item is OfflineQueueItem => Boolean(item))
}

export function getOfflineQueueCount(): number {
  return readQueue().length
}

export function getOfflineConflictCount(): number {
  return readConflicts().length
}

export function clearOfflineConflicts() {
  writeConflicts([])
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

export function enqueueOfflineFinishReadingSession(uid: string, payload: QueuedFinishSessionPayload) {
  const items = readQueue()
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    action: 'finish_reading_session',
    uid,
    payload,
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
        if (item.action === 'finish_reading_session' && item.payload) {
          const payload = item.payload as QueuedFinishSessionPayload
          await createReadingSessionWithId(item.uid, `offline-${payload.transactionId}`, {
            bookId: payload.bookId,
            startedAt: new Date(payload.startedAt),
            endedAt: new Date(payload.endedAt),
            durationSeconds: payload.durationSeconds,
            startPage: payload.startPage,
            endPage: payload.endPage,
            pagesRead: payload.pagesRead,
          })
          await updateLibraryBookMetadata(item.uid, payload.bookId, {
            totalPages: payload.totalPages,
            currentPage: payload.currentPage,
            status: payload.status,
          })
        }
      } catch {
        if (item.action === 'finish_reading_session') {
          appendConflict(item)
          continue
        }
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
