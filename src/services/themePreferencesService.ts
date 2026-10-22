import { getFirebaseDb } from '../lib/firebase'
import { isThemePreferences } from '../config/themePalettes'
import type { ThemePreferences } from '../types/theme'

async function getContext(uid: string) {
  if (!uid) throw new Error('A user is required to access appearance preferences.')
  const db = await getFirebaseDb()
  if (!db) throw new Error('Firebase Firestore is not configured.')
  const sdk = await import('firebase/firestore')
  return { sdk, ref: sdk.doc(db, 'users', uid, 'preferences', 'appearance') }
}

export async function fetchThemePreferences(uid: string): Promise<ThemePreferences | null> {
  const { sdk, ref } = await getContext(uid)
  const snapshot = await sdk.getDoc(ref)
  if (!snapshot.exists()) return null
  const data = snapshot.data()
  if (!isThemePreferences(data)) throw new Error('Invalid appearance preferences.')
  return { mode: data.mode, palette: data.palette }
}

export async function saveThemePreferences(uid: string, preferences: ThemePreferences): Promise<void> {
  if (!isThemePreferences(preferences)) throw new Error('Invalid appearance preferences.')
  const { sdk, ref } = await getContext(uid)
  await sdk.setDoc(ref, {
    mode: preferences.mode,
    palette: preferences.palette,
    updatedAt: sdk.serverTimestamp(),
  })
}
