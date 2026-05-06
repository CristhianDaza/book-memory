import { getFirebaseDb } from '../lib/firebase'
import { fetchLibraryBooks } from './libraryService'
import { fetchReadingState } from './readingStateService'
import { fetchUserSessions } from './readingSessionService'
import { fetchStatsGoals } from './statsGoalsService'
import { fetchStreakDays } from './streakService'
import type { UserDataExport } from '../types/account'

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

async function deleteCollectionByChunks(uid: string, collectionName: string) {
  const db = await ensureFirestore()
  const { collection, getDocs, limit, query, writeBatch } = await getFirestoreSdk()

  while (true) {
    const ref = collection(db, 'users', uid, collectionName)
    const snapshot = await getDocs(query(ref, limit(400)))
    if (snapshot.empty) break

    const batch = writeBatch(db)
    snapshot.docs.forEach((entry) => {
      batch.delete(entry.ref)
    })
    await batch.commit()
  }
}

export async function exportUserData(uid: string): Promise<UserDataExport> {
  const [library, sessions, readingState, goals, streakDays] = await Promise.all([
    fetchLibraryBooks(uid),
    fetchUserSessions(uid),
    fetchReadingState(uid),
    fetchStatsGoals(uid),
    fetchStreakDays(uid),
  ])

  return {
    exportedAt: new Date().toISOString(),
    uid,
    library,
    sessions,
    readingState,
    goals,
    streakDays,
  }
}

export async function deleteUserData(uid: string): Promise<void> {
  await deleteCollectionByChunks(uid, 'library')
  await deleteCollectionByChunks(uid, 'sessions')
  await deleteCollectionByChunks(uid, 'reading_state')
  await deleteCollectionByChunks(uid, 'stats')
  await deleteCollectionByChunks(uid, 'streak_days')
  await deleteCollectionByChunks(uid, 'app_logs')
}
