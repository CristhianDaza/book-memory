import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { firebaseDb } from '../lib/firebase'
import type { BookSearchResult, LibraryBook } from '../types/books'

function ensureFirestore() {
  if (!firebaseDb) {
    throw new Error('Firebase Firestore is not configured.')
  }
  return firebaseDb
}

function toLibraryDocId(searchResult: BookSearchResult): string {
  return searchResult.id.replace(':', '_')
}

export async function fetchLibraryBooks(uid: string): Promise<LibraryBook[]> {
  const db = ensureFirestore()
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
  const db = ensureFirestore()
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
    status: 'reading',
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
  const db = ensureFirestore()
  const ref = doc(db, 'users', uid, 'library', bookId)
  await updateDoc(ref, {
    favorite,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteLibraryBook(uid: string, bookId: string) {
  const db = ensureFirestore()
  const ref = doc(db, 'users', uid, 'library', bookId)
  await deleteDoc(ref)
}
