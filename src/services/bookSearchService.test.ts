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

    const result = await searchBooks('clean code', 0, 20)

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
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toEqual(
      expect.stringContaining('https://www.googleapis.com/books/v1/volumes'),
    )
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).not.toEqual(expect.stringContaining('langRestrict'))
  })

  it('falls back to Open Library when Google Books fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            numFound: 1,
            docs: [
              {
                key: '/works/OL123W',
                title: 'Clean Code',
                author_name: ['Robert C. Martin'],
                first_publish_year: 2008,
                number_of_pages_median: 464,
                language: ['eng'],
              },
            ],
          }),
        }),
    )
    const { searchBooks } = await loadService()

    const result = await searchBooks('clean code', 0, 20)

    expect(result.totalItems).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'openlibrary:OL123W',
      source: 'openlibrary',
      title: 'Clean Code',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toEqual(
      expect.stringContaining('https://openlibrary.org/search.json'),
    )
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).not.toEqual(expect.stringContaining('language='))
  })

  it('falls back to Open Library when Google Books returns no usable results', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            totalItems: 0,
            items: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            numFound: 1,
            docs: [
              {
                key: '/works/OL123W',
                title: 'Clean Code',
                author_name: ['Robert C. Martin'],
                first_publish_year: 2008,
              },
            ],
          }),
        }),
    )
    const { searchBooks } = await loadService()

    const result = await searchBooks('clean code', 0, 20)

    expect(result.totalItems).toBe(1)
    expect(result.items[0]).toMatchObject({
      id: 'openlibrary:OL123W',
      source: 'openlibrary',
      title: 'Clean Code',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('throws original Google error when both providers fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        })
        .mockRejectedValueOnce(new Error('offline')),
    )
    const { searchBooks } = await loadService()

    await expect(searchBooks('dune', 0, 20)).rejects.toMatchObject({
      name: 'SearchBooksError',
      code: 'quota_exceeded',
    })
  })

  it('does not block future Google Books calls after a quota/auth failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            numFound: 1,
            docs: [
              {
                key: '/works/OL123W',
                title: 'Fallback Book',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            totalItems: 1,
            items: [
              {
                id: 'google-ok',
                volumeInfo: {
                  title: 'Google Book',
                },
              },
            ],
          }),
        }),
    )
    const { searchBooks } = await loadService()

    const fallbackResult = await searchBooks('first search', 0, 20)
    const googleResult = await searchBooks('second search', 0, 20)

    expect(fallbackResult.items[0]).toMatchObject({
      source: 'openlibrary',
      title: 'Fallback Book',
    })
    expect(googleResult.items[0]).toMatchObject({
      source: 'google',
      title: 'Google Book',
    })
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(vi.mocked(fetch).mock.calls[2]?.[0]).toEqual(
      expect.stringContaining('https://www.googleapis.com/books/v1/volumes'),
    )
  })

  it('prioritizes titles that best match the original query', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          totalItems: 3,
          items: [
            {
              id: 'english',
              volumeInfo: {
                title: "Harry Potter and the Philosopher's Stone",
                authors: ['J. K. Rowling'],
              },
            },
            {
              id: 'spanish',
              volumeInfo: {
                title: 'Harry Potter y la piedra filosofal',
                authors: ['J. K. Rowling'],
              },
            },
            {
              id: 'exact',
              volumeInfo: {
                title: 'La piedra filosofal',
                authors: ['J. K. Rowling'],
              },
            },
          ],
        }),
      }),
    )
    const { searchBooks } = await loadService()

    const result = await searchBooks('la piedra filosofal', 0, 20)

    expect(result.items.map((item) => item.title)).toEqual([
      'La piedra filosofal',
      'Harry Potter y la piedra filosofal',
      "Harry Potter and the Philosopher's Stone",
    ])
  })
})
