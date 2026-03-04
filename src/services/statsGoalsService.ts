import { getFirebaseDb } from '../lib/firebase'

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

export interface StatsGoalsRecord {
  weeklyPagesGoal: number
  monthlyMinutesGoal: number
}

export async function fetchStatsGoals(uid: string): Promise<StatsGoalsRecord | null> {
  const db = await ensureFirestore()
  const { doc, getDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'stats', 'goals')
  const snapshot = await getDoc(ref)
  if (!snapshot.exists()) return null
  const data = snapshot.data() as Partial<StatsGoalsRecord>
  const weeklyPagesGoal = Number(data.weeklyPagesGoal)
  const monthlyMinutesGoal = Number(data.monthlyMinutesGoal)
  if (!Number.isFinite(weeklyPagesGoal) || !Number.isFinite(monthlyMinutesGoal)) return null
  return {
    weeklyPagesGoal: Math.max(1, Math.floor(weeklyPagesGoal)),
    monthlyMinutesGoal: Math.max(1, Math.floor(monthlyMinutesGoal)),
  }
}

export async function saveStatsGoals(uid: string, payload: StatsGoalsRecord): Promise<void> {
  const db = await ensureFirestore()
  const { doc, serverTimestamp, setDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'stats', 'goals')
  await setDoc(
    ref,
    {
      weeklyPagesGoal: Math.max(1, Math.floor(payload.weeklyPagesGoal)),
      monthlyMinutesGoal: Math.max(1, Math.floor(payload.monthlyMinutesGoal)),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
