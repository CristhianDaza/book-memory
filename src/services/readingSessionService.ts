import { getFirebaseDb } from '../lib/firebase'
import type { CreateReadingSessionInput, FirestoreTimestampLike, ReadingSessionRecord } from '../types/reading'

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

function toMillis(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as FirestoreTimestampLike).toDate().getTime()
  }
  return 0
}

export async function fetchRecentSessionsForBook(
  uid: string,
  bookId: string,
  maxResults = 5,
): Promise<ReadingSessionRecord[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, query, where } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'sessions')
  const q = query(ref, where('bookId', '==', bookId))
  const snapshot = await getDocs(q)

  const sessions = snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<ReadingSessionRecord, 'id'>
    return {
      id: entry.id,
      ...data,
    }
  })

  return sessions
    .sort((a, b) => toMillis(b.startedAt) - toMillis(a.startedAt))
    .slice(0, Math.max(0, maxResults))
}

export async function fetchSessionsForBook(uid: string, bookId: string): Promise<ReadingSessionRecord[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, query, where } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'sessions')
  const q = query(ref, where('bookId', '==', bookId))
  const snapshot = await getDocs(q)

  const sessions = snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<ReadingSessionRecord, 'id'>
    return {
      id: entry.id,
      ...data,
    }
  })

  return sessions.sort((a, b) => toMillis(b.startedAt) - toMillis(a.startedAt))
}

export async function fetchUserSessions(uid: string): Promise<ReadingSessionRecord[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, orderBy, query } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'sessions')
  const q = query(ref, orderBy('startedAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<ReadingSessionRecord, 'id'>
    return {
      id: entry.id,
      ...data,
    }
  })
}

export async function createReadingSession(uid: string, payload: CreateReadingSessionInput): Promise<void> {
  const db = await ensureFirestore()
  const { Timestamp, addDoc, collection, serverTimestamp } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'sessions')

  await addDoc(ref, {
    bookId: payload.bookId,
    startedAt: Timestamp.fromDate(payload.startedAt),
    endedAt: Timestamp.fromDate(payload.endedAt),
    durationSeconds: payload.durationSeconds,
    startPage: payload.startPage,
    endPage: payload.endPage,
    pagesRead: payload.pagesRead,
    createdAt: serverTimestamp(),
  })
}

export async function createReadingSessionWithId(
  uid: string,
  sessionId: string,
  payload: CreateReadingSessionInput,
): Promise<void> {
  const db = await ensureFirestore()
  const { Timestamp, doc, serverTimestamp, setDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'sessions', sessionId)
  await setDoc(
    ref,
    {
      bookId: payload.bookId,
      startedAt: Timestamp.fromDate(payload.startedAt),
      endedAt: Timestamp.fromDate(payload.endedAt),
      durationSeconds: payload.durationSeconds,
      startPage: payload.startPage,
      endPage: payload.endPage,
      pagesRead: payload.pagesRead,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function updateReadingSession(
  uid: string,
  sessionId: string,
  payload: Pick<ReadingSessionRecord, 'startPage' | 'endPage' | 'pagesRead' | 'durationSeconds'>,
): Promise<void> {
  const db = await ensureFirestore()
  const { doc, serverTimestamp, updateDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'sessions', sessionId)
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteReadingSession(uid: string, sessionId: string): Promise<void> {
  const db = await ensureFirestore()
  const { deleteDoc, doc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'sessions', sessionId)
  await deleteDoc(ref)
}

export async function deleteSessionsForBook(uid: string, bookId: string): Promise<void> {
  const db = await ensureFirestore()
  const { collection, getDocs, query, where, writeBatch } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'sessions')
  const snapshot = await getDocs(query(ref, where('bookId', '==', bookId)))
  if (snapshot.empty) return

  const docs = snapshot.docs
  const chunkSize = 450
  for (let index = 0; index < docs.length; index += chunkSize) {
    const batch = writeBatch(db)
    const chunk = docs.slice(index, index + chunkSize)
    chunk.forEach((entry) => {
      batch.delete(entry.ref)
    })
    await batch.commit()
  }
}
