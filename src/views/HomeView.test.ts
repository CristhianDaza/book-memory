import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import HomeView from './HomeView.vue'
import { en } from '../i18n/messages/en'
import { es } from '../i18n/messages/es'

vi.mock('pinia', async () => {
  const actual = await vi.importActual<typeof import('pinia')>('pinia')
  return {
    ...actual,
    storeToRefs: <T extends object>(store: T) => store,
  }
})

const mocks = vi.hoisted(() => {
  function refLike<T>(value: T) {
    return { value, __v_isRef: true }
  }

  let resolveLibraryLoad: (() => void) | null = null
  const ensureLibraryLoaded = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveLibraryLoad = resolve
      }),
  )

  return {
    authStore: {
      user: refLike({ uid: 'user-1', email: 'reader@example.com' }),
    },
    booksStore: {
      library: refLike([]),
      loadingLibrary: refLike(false),
      favoriteUpdatingIds: refLike([]),
      ensureLibraryLoaded,
      toggleFavorite: vi.fn(),
    },
    sessionsStore: {
      latestSessionMillisByBook: refLike({}),
      allSessions: [],
      ensureSessionsLoaded: vi.fn(),
    },
    readingPlanHistoryStore: {
      records: [],
      ensureHistoryLoaded: vi.fn(),
    },
    streakStore: {
      currentStreakDays: refLike(0),
      bestStreakDays: refLike(0),
      migrateFromSessions: vi.fn(),
    },
    resolveLibraryLoad: () => resolveLibraryLoad?.(),
  }
})

vi.mock('../stores/auth', () => ({
  useAuthStore: () => mocks.authStore,
}))

vi.mock('../stores/books', () => ({
  useBooksStore: () => mocks.booksStore,
}))

vi.mock('../stores/sessions', () => ({
  useSessionsStore: () => mocks.sessionsStore,
}))

vi.mock('../stores/readingPlanHistory', () => ({
  useReadingPlanHistoryStore: () => mocks.readingPlanHistoryStore,
}))

vi.mock('../stores/streak', () => ({
  useStreakStore: () => mocks.streakStore,
}))

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: { en, es },
  })
}

describe('HomeView', () => {
  it('shows a continue reading skeleton while dashboard data is loading', async () => {
    const wrapper = mount(HomeView, {
      global: {
        plugins: [makeI18n()],
        stubs: {
          RouterLink: {
            props: ['to'],
            template: '<a><slot /></a>',
          },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No in-progress books yet.')

    mocks.resolveLibraryLoad()
    await Promise.resolve()
    await flushPromises()
    await flushPromises()

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('No in-progress books yet.')
  })
})
