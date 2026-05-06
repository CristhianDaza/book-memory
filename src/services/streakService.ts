import { getFirebaseDb } from '../lib/firebase'
import type {
  MarkStreakDayPayload,
  MarkStreakDayResult,
  StreakActivityAction,
  StreakDayRecord,
} from '../types/streak'

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

function normalizeActions(actions: unknown, fallback: StreakActivityAction): StreakActivityAction[] {
  if (!Array.isArray(actions)) return [fallback]
  return Array.from(new Set([fallback, ...actions])).filter((action): action is StreakActivityAction =>
    ['book_added', 'status_changed', 'book_finished', 'reading_session_finished'].includes(String(action)),
  )
}

export async function fetchStreakDays(uid: string): Promise<StreakDayRecord[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, orderBy, query } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'streak_days')
  const snapshot = await getDocs(query(ref, orderBy('dayId', 'desc')))

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<StreakDayRecord, 'id'>
    return {
      id: entry.id,
      ...data,
      actions: normalizeActions(data.actions, data.firstAction),
    }
  })
}

export async function markStreakDay(uid: string, payload: MarkStreakDayPayload): Promise<MarkStreakDayResult> {
  const db = await ensureFirestore()
  const { doc, getDoc, serverTimestamp, setDoc, updateDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'streak_days', payload.dayId)
  const snapshot = await getDoc(ref)

  if (!snapshot.exists()) {
    const record: Omit<StreakDayRecord, 'id'> = {
      dayId: payload.dayId,
      actions: [payload.action],
      firstAction: payload.action,
      lastAction: payload.action,
      activityCount: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    await setDoc(ref, record)
    return {
      created: true,
      record: {
        id: payload.dayId,
        ...record,
      },
    }
  }

  const data = snapshot.data() as Omit<StreakDayRecord, 'id'>
  const actions = normalizeActions(data.actions, payload.action)
  await updateDoc(ref, {
    actions,
    lastAction: payload.action,
    activityCount: actions.length,
    updatedAt: serverTimestamp(),
  })

  return {
    created: false,
    record: {
      id: snapshot.id,
      ...data,
      actions,
      lastAction: payload.action,
      activityCount: actions.length,
    },
  }
}
