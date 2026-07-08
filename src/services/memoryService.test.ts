import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemory, deleteMemory, fetchMemories, updateMemory } from './memoryService'

const getDocs = vi.fn()
const addDoc = vi.fn()
const updateDoc = vi.fn()
const deleteDoc = vi.fn()
const collection = vi.fn((...parts: string[]) => parts.join('/'))
const doc = vi.fn((...parts: string[]) => parts.join('/'))
const query = vi.fn((...args: unknown[]) => args)
const orderBy = vi.fn((field: string, direction: string) => ({ field, direction }))
const serverTimestamp = vi.fn(() => 'server-time')
const Timestamp = {
  fromDate: vi.fn((date: Date) => ({ date })),
}

vi.mock('../lib/firebase', () => ({
  getFirebaseDb: vi.fn(async () => 'db'),
}))

vi.mock('firebase/firestore', () => ({
  collection,
  doc,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
}))

describe('memory service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches memories ordered by updated date', async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: 'memory-1',
          data: () => ({
            bookId: 'book-1',
            kind: 'quote',
            content: 'A quote',
            page: null,
            tags: undefined,
            favorite: undefined,
            reviewStatus: undefined,
            nextReviewAt: new Date(),
          }),
        },
      ],
    })

    const memories = await fetchMemories('user-1')

    expect(collection).toHaveBeenCalledWith('db', 'users', 'user-1', 'memories')
    expect(orderBy).toHaveBeenCalledWith('updatedAt', 'desc')
    expect(memories[0]).toMatchObject({
      id: 'memory-1',
      tags: [],
      favorite: false,
      reviewStatus: 'pending',
    })
  })

  it('creates a memory with normalized tags and a review date', async () => {
    addDoc.mockResolvedValue({ id: 'created-1' })

    const created = await createMemory('user-1', {
      bookId: 'book-1',
      kind: 'idea',
      content: ' Keep this ',
      page: 4,
      tags: [' Focus ', 'focus'],
      favorite: true,
    })

    expect(addDoc).toHaveBeenCalledWith(
      'db/users/user-1/memories',
      expect.objectContaining({
        content: 'Keep this',
        tags: ['focus'],
        favorite: true,
        reviewStatus: 'pending',
      }),
    )
    expect(Timestamp.fromDate).toHaveBeenCalledWith(expect.any(Date))
    expect(created.id).toBe('created-1')
  })

  it('updates and deletes memories', async () => {
    const nextReviewAt = new Date('2026-07-08T00:00:00.000Z')

    await updateMemory('user-1', 'memory-1', {
      content: ' Updated ',
      tags: ['Learning'],
      nextReviewAt,
    })
    await deleteMemory('user-1', 'memory-1')

    expect(updateDoc).toHaveBeenCalledWith(
      'db/users/user-1/memories/memory-1',
      expect.objectContaining({
        content: 'Updated',
        tags: ['learning'],
        nextReviewAt: { date: nextReviewAt },
      }),
    )
    expect(deleteDoc).toHaveBeenCalledWith('db/users/user-1/memories/memory-1')
  })
})

