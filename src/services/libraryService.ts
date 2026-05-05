import { getFirebaseDb } from '../lib/firebase'
import type { BookSearchResult, LibraryBook } from '../types/books'

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

function toLibraryDocId(searchResult: BookSearchResult): string {
  return searchResult.id.replace(':', '_')
}

export async function fetchLibraryBooks(uid: string): Promise<LibraryBook[]> {
  const db = await ensureFirestore()
  const { collection, getDocs, orderBy, query } = await getFirestoreSdk()
  const ref = collection(db, 'users', uid, 'library')
  const snapshot = await getDocs(query(ref, orderBy('updatedAt', 'desc')))

  return snapshot.docs.map((entry) => {
    const data = entry.data() as Omit<LibraryBook, 'id'>
    return {
      id: entry.id,
      ...data,
      favorite: data.favorite ?? false,
    }
  })
}

export async function addBookToLibrary(uid: string, book: BookSearchResult): Promise<LibraryBook> {
  const db = await ensureFirestore()
  const { doc, serverTimestamp, setDoc } = await getFirestoreSdk()
  const id = toLibraryDocId(book)
  const ref = doc(db, 'users', uid, 'library', id)

  const payload: Omit<LibraryBook, 'id'> = {
    source: book.source,
    externalId: book.id.split(':')[1] ?? book.id,
    title: book.title,
    authors: book.authors,
    coverUrl: book.coverUrl,
    totalPages: book.totalPages,
    favorite: false,
    currentPage: 0,
    status: 'wishlist',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await setDoc(ref, payload, { merge: true })

  return {
    id,
    ...payload,
  }
}

export async function updateLibraryBookFavorite(uid: string, bookId: string, favorite: boolean) {
  const db = await ensureFirestore()
  const { doc, serverTimestamp, updateDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'library', bookId)
  await updateDoc(ref, {
    favorite,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteLibraryBook(uid: string, bookId: string) {
  const db = await ensureFirestore()
  const { deleteDoc, doc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'library', bookId)
  await deleteDoc(ref)
}

export async function updateLibraryBookMetadata(
  uid: string,
  bookId: string,
  payload: Pick<LibraryBook, 'totalPages' | 'currentPage' | 'status'>,
) {
  const db = await ensureFirestore()
  const { doc, serverTimestamp, updateDoc } = await getFirestoreSdk()
  const ref = doc(db, 'users', uid, 'library', bookId)
  await updateDoc(ref, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}
