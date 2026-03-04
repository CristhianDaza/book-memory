import { flushPromises, shallowMount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { en } from './i18n/messages/en'
import { es } from './i18n/messages/es'

const routeState = vi.hoisted(() => ({
  name: 'home',
  fullPath: '/',
}))

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
}))

const mockAuthStore = vi.hoisted(() => ({
  logout: vi.fn(),
}))

const mockOfflineQueueService = vi.hoisted(() => ({
  clearOfflineConflicts: vi.fn(),
  getOfflineConflicts: vi.fn(),
  getOfflineConflictCount: vi.fn(),
  getRetryableOfflineConflictCount: vi.fn(),
  getOfflineQueueCount: vi.fn(),
  onOfflineQueueChange: vi.fn(),
  requeueOfflineConflicts: vi.fn(),
  replayOfflineQueue: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => mockRouter,
}))

vi.mock('./stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

vi.mock('./services/offlineQueueService', () => mockOfflineQueueService)

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'es',
    fallbackLocale: 'en',
    messages: { es, en },
  })
}

describe('App sync banner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeState.name = 'home'
    routeState.fullPath = '/'
    vi.stubGlobal('navigator', { onLine: true })
    mockOfflineQueueService.getOfflineQueueCount.mockReturnValue(0)
    mockOfflineQueueService.getOfflineConflictCount.mockReturnValue(0)
    mockOfflineQueueService.getRetryableOfflineConflictCount.mockReturnValue(0)
    mockOfflineQueueService.getOfflineConflicts.mockReturnValue([])
    mockOfflineQueueService.onOfflineQueueChange.mockReturnValue(() => {})
    mockOfflineQueueService.replayOfflineQueue.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows offline pending banner and triggers retry action', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    mockOfflineQueueService.getOfflineQueueCount.mockReturnValue(2)

    const wrapper = shallowMount(App, {
      global: {
        plugins: [makeI18n()],
        stubs: {
          AppNotifications: true,
          ConfirmModal: true,
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Sin conexion. Operaciones pendientes: 2.')
    const retryButton = wrapper.findAll('button').find((button) => button.text() === 'Reintentar sincronizacion')
    expect(retryButton).toBeDefined()
    expect(retryButton!.attributes('disabled')).toBeDefined()
  })

  it('shows conflict banner and executes retry conflicts action', async () => {
    mockOfflineQueueService.getOfflineQueueCount.mockReturnValue(1)
    mockOfflineQueueService.getOfflineConflictCount.mockReturnValue(1)
    mockOfflineQueueService.getRetryableOfflineConflictCount.mockReturnValue(1)
    mockOfflineQueueService.getOfflineConflicts.mockReturnValue([
      {
        id: 'finish:tx-1',
        action: 'finish_reading_session',
        uid: 'u1',
        payload: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        failedAt: '2026-01-01T00:01:00.000Z',
        errorMessage: 'permission',
        retryCount: 1,
        status: 'open',
        nextRetryAt: '2026-01-01T00:02:00.000Z',
      },
    ])

    const wrapper = shallowMount(App, {
      global: {
        plugins: [makeI18n()],
        stubs: {
          AppNotifications: true,
          ConfirmModal: true,
          RouterLink: {
            template: '<a><slot /></a>',
          },
          RouterView: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Conflictos de sincronizacion: 1.')

    const retryConflictsButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Reintentar conflictos'))
    expect(retryConflictsButton).toBeDefined()
    await retryConflictsButton!.trigger('click')
    expect(mockOfflineQueueService.requeueOfflineConflicts).toHaveBeenCalledTimes(1)
    expect(mockOfflineQueueService.replayOfflineQueue).toHaveBeenCalledTimes(1)
  })
})
