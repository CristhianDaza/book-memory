import {
  Timestamp,
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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
