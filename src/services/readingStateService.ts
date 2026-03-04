import { getFirebaseDb } from '../lib/firebase'
import type { CloudReadingState, ReadingStateTimestampLike } from '../types/reading-state'

let firestoreSdkPromise: Promise<typeof import('firebase/firestore')> | null = null

function getFirestoreSdk() {
  if (!firestoreSdkPromise) {
    firestoreSdkPromise = import('firebase/firestore')
  }
  return firestoreSdkPromise
}

async function ensureFirestore() {
  const db = await getFirebaseDb()
  if (!db) {
    throw new Error('Firebase Firestore is not configured.')
  }
  return db
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as ReadingStateTimestampLike).toDate()
  }
  return null
}

export async function fetchReadingState(uid: string): Promise<CloudReadingState | null> {
  const db = await ensureFirestore()
  const { doc, getDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'reading_state', 'current')
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null

  const data = snapshot.data()
  return {
    selectedBookId: typeof data.selectedBookId === 'string' ? data.selectedBookId : '',
    sessionBookId: typeof data.sessionBookId === 'string' ? data.sessionBookId : null,
    startPage: Number.isFinite(data.startPage) ? Math.max(0, Math.floor(data.startPage)) : 0,
    endPage: Number.isFinite(data.endPage) ? Math.max(0, Math.floor(data.endPage)) : 0,
    elapsedSeconds: Number.isFinite(data.elapsedSeconds) ? Math.max(0, Math.floor(data.elapsedSeconds)) : 0,
    sessionStartedAt: toDate(data.sessionStartedAt),
    running: Boolean(data.running),
    persistedAt: toDate(data.persistedAt) ?? new Date(0),
  }
}

export async function saveReadingState(uid: string, state: CloudReadingState): Promise<void> {
  const db = await ensureFirestore()
  const { Timestamp, doc, serverTimestamp, setDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'reading_state', 'current')

  await setDoc(
    ref,
    {
      selectedBookId: state.selectedBookId,
      sessionBookId: state.sessionBookId,
      startPage: state.startPage,
      endPage: state.endPage,
      elapsedSeconds: state.elapsedSeconds,
      sessionStartedAt: state.sessionStartedAt ? Timestamp.fromDate(state.sessionStartedAt) : null,
      running: state.running,
      persistedAt: Timestamp.fromDate(state.persistedAt),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function clearReadingState(uid: string): Promise<void> {
  const db = await ensureFirestore()
  const { deleteDoc, doc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'reading_state', 'current')
  await deleteDoc(ref)
}
