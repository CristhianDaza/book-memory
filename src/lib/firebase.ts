import { initializeApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Object.values(firebaseConfig).every((value) => Boolean(value))

export const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null
let firebaseAuthInstance: Auth | null | undefined
let firebaseDbInstance: Firestore | null | undefined

export async function getFirebaseAuth(): Promise<Auth | null> {
  if (!hasFirebaseConfig || !firebaseApp) return null
  if (firebaseAuthInstance !== undefined) return firebaseAuthInstance

  const { getAuth } = await import('firebase/auth')
  firebaseAuthInstance = getAuth(firebaseApp)
  return firebaseAuthInstance
}

export async function getFirebaseDb(): Promise<Firestore | null> {
  if (!hasFirebaseConfig || !firebaseApp) return null
  if (firebaseDbInstance !== undefined) return firebaseDbInstance

  const { getFirestore } = await import('firebase/firestore')
  firebaseDbInstance = getFirestore(firebaseApp)
  return firebaseDbInstance
}

export function isFirebaseConfigured(): boolean {
  return hasFirebaseConfig
}
