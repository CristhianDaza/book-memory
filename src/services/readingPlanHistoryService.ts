import { getFirebaseDb } from '../lib/firebase'
import type { ReadingPlanDayRecord } from '../types/books'

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

export function toReadingPlanDayRecordId(bookId: string, dayId: string): string {
  return `${bookId}_${dayId}`
}

export async function fetchReadingPlanDayRecords(uid: string): Promise<ReadingPlanDayRecord[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, orderBy, query } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'reading_plan_days')
  const snapshot = await getDocs(query(ref, orderBy('dayId', 'desc')))

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<ReadingPlanDayRecord, 'id'>
    return {
      id: entry.id,
      ...data,
    }
  })
}

export async function upsertReadingPlanDayRecord(
  uid: string,
  payload: Omit<ReadingPlanDayRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ReadingPlanDayRecord> {
  const db = await ensureFirestore()
  const { doc, serverTimestamp, setDoc } = await getFirestoreSdk()
  const id = toReadingPlanDayRecordId(payload.bookId, payload.dayId)
  const ref = doc(db, 'users', uid, 'reading_plan_days', id)
  const now = serverTimestamp()

  await setDoc(
    ref,
    {
      ...payload,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )

  return {
    id,
    ...payload,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}
