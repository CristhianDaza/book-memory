import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadService() {
  return import('./bookSearchService')
}

describe('bookSearchService', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns normalized books when Google Books responds OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          totalItems: 1,
          items: [
            {
              id: 'abc123',
              volumeInfo: {
                title: 'Clean Code',
                authors: ['Robert C. Martin'],
                pageCount: 464,
                publishedDate: '2008-08-01',
              },
            },
          ],
        }),
      }),
    )
    const { searchBooks } = await loadService()

    const result = await searchBooks('clean code', 'en', 'active', 0, 20)

    expect(result.totalItems).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'google:abc123',
      source: 'google',
      title: 'Clean Code',
      authors: ['Robert C. Martin'],
      totalPages: 464,
      publishedYear: 2008,
    })
  })

  it('throws quota_exceeded on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      }),
    )
    const { searchBooks } = await loadService()

    await expect(searchBooks('dune', 'en', 'active', 0, 20)).rejects.toMatchObject({
      name: 'SearchBooksError',
      code: 'quota_exceeded',
    })
  })

  it('throws network_error when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { searchBooks } = await loadService()

    await expect(searchBooks('dune', 'en', 'active', 0, 20)).rejects.toMatchObject({
      name: 'SearchBooksError',
      code: 'network_error',
    })
  })
})
