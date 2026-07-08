import { getFirebaseDb } from '../lib/firebase'
import type { BookMemory, CreateBookMemoryInput, UpdateBookMemoryInput } from '../types/memories'
import { nextReviewDateForNewMemory, normalizeMemoryTags } from '../utils/memories'

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

export async function fetchMemories(uid: string): Promise<BookMemory[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, orderBy, query } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'memories')
  const snapshot = await getDocs(query(ref, orderBy('updatedAt', 'desc')))

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<BookMemory, 'id'>
    return {
      id: entry.id,
      ...data,
      page: data.page ?? null,
      tags: data.tags ?? [],
      favorite: data.favorite ?? false,
      reviewStatus: data.reviewStatus ?? 'pending',
    }
  })
}

export async function createMemory(uid: string, payload: CreateBookMemoryInput): Promise<BookMemory> {
  const db = await ensureFirestore()
  const { Timestamp, addDoc, collection, serverTimestamp } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'memories')
  const nextReviewAt = nextReviewDateForNewMemory()
  const docPayload = {
    bookId: payload.bookId,
    kind: payload.kind,
    content: payload.content.trim(),
    page: payload.page,
    tags: normalizeMemoryTags(payload.tags),
    favorite: payload.favorite ?? false,
    reviewStatus: 'pending' as const,
    nextReviewAt: Timestamp.fromDate(nextReviewAt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const docRef = await addDoc(ref, docPayload)

  return {
    id: docRef.id,
    ...docPayload,
    nextReviewAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export async function updateMemory(uid: string, memoryId: string, payload: UpdateBookMemoryInput): Promise<void> {
  const db = await ensureFirestore()
  const { Timestamp, doc, serverTimestamp, updateDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'memories', memoryId)
  const updatePayload: Record<string, unknown> = {
    ...payload,
    updatedAt: serverTimestamp(),
  }
  if (payload.content !== undefined) updatePayload.content = payload.content.trim()
  if (payload.tags !== undefined) updatePayload.tags = normalizeMemoryTags(payload.tags)
  if (payload.nextReviewAt !== undefined) updatePayload.nextReviewAt = Timestamp.fromDate(payload.nextReviewAt)
  await updateDoc(ref, updatePayload)
}

export async function deleteMemory(uid: string, memoryId: string): Promise<void> {
  const db = await ensureFirestore()
  const { deleteDoc, doc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'memories', memoryId)
  await deleteDoc(ref)
}

