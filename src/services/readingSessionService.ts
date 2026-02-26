import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { firebaseDb } from '../lib/firebase'
import type { ReadingSessionRecord } from '../types/reading'

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
