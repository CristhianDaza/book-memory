import { getFirebaseDb } from '../lib/firebase'
import type { AppLogRecord } from '../types/observability'

let firestoreSdkPromise: Promise<typeof import('firebase/firestore')> | null = null

function getFirestoreSdk() {
  if (!firestoreSdkPromise) {
    firestoreSdkPromise = import('firebase/firestore')
  }
  return firestoreSdkPromise
}

async function ensureFirestore() {
  const db = await getFirebaseDb()
  if (!db) return null
  return db
}

export async function logAppEvent(uid: string, payload: AppLogRecord): Promise<void> {
  const db = await ensureFirestore()
  if (!db) return
  const { addDoc, collection, serverTimestamp } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'app_logs')
  await addDoc(ref, {
    kind: payload.kind,
    message: payload.message,
    stack: payload.stack,
    path: payload.path,
    createdAt: serverTimestamp(),
  })
}
