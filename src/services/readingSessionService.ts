import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore'
import { firebaseDb } from '../lib/firebase'
import type { CreateReadingSessionInput, ReadingSessionRecord } from '../types/reading'

function ensureFirestore() {
  if (!firebaseDb) {
    throw new Error('Firebase Firestore is not configured.')
  }
  return firebaseDb
}

export async function fetchRecentSessionsForBook(
  uid: string,
  bookId: string,
  maxResults = 5,
): Promise<ReadingSessionRecord[]> {
  const db = ensureFirestore()
  const ref = collection(db, 'users', uid, 'sessions')
  const q = query(ref, where('bookId', '==', bookId), orderBy('startedAt', 'desc'), limit(maxResults))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<ReadingSessionRecord, 'id'>
    return {
      id: entry.id,
      ...data,
    }
  })
}

export async function fetchSessionsForBook(uid: string, bookId: string): Promise<ReadingSessionRecord[]> {
  const db = ensureFirestore()
  const ref = collection(db, 'users', uid, 'sessions')
  const q = query(ref, where('bookId', '==', bookId), orderBy('startedAt', 'desc'))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<ReadingSessionRecord, 'id'>
    return {
      id: entry.id,
      ...data,
    }
  })
}

export async function fetchUserSessions(uid: string): Promise<ReadingSessionRecord[]> {
  const db = ensureFirestore()
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
  const db = ensureFirestore()
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

export async function updateReadingSession(
  uid: string,
  sessionId: string,
  payload: Pick<ReadingSessionRecord, 'startPage' | 'endPage' | 'pagesRead' | 'durationSeconds'>,
): Promise<void> {
  const db = ensureFirestore()
  const ref = doc(db, 'users', uid, 'sessions', sessionId)
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteReadingSession(uid: string, sessionId: string): Promise<void> {
  const db = ensureFirestore()
  const ref = doc(db, 'users', uid, 'sessions', sessionId)
  await deleteDoc(ref)
}

export async function deleteSessionsForBook(uid: string, bookId: string): Promise<void> {
  const db = ensureFirestore()
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
