import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SyncCenterView from './SyncCenterView.vue'
import { en } from '../../../i18n/messages/en'
import { es } from '../../../i18n/messages/es'
import type { OfflineConflictItem, OfflineQueueItem } from '../../../types/offline-queue'

const mockOfflineQueueService = vi.hoisted(() => ({
  getOfflineConflictCount: vi.fn(),
  getOfflineConflicts: vi.fn(),
  getOfflineQueueCount: vi.fn(),
  getOfflineQueueItems: vi.fn(),
  onOfflineQueueChange: vi.fn(),
  removeOfflineConflict: vi.fn(),
  removeOfflineQueueItem: vi.fn(),
  requeueOfflineConflictById: vi.fn(),
  replayOfflineQueue: vi.fn(),
}))

vi.mock('../../../services/offlineQueueService', () => mockOfflineQueueService)

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'es',
    fallbackLocale: 'en',
    messages: { es, en },
  })
}

describe('SyncCenterView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('navigator', { onLine: true })
    mockOfflineQueueService.onOfflineQueueChange.mockReturnValue(() => {})
    mockOfflineQueueService.replayOfflineQueue.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders queue and conflicts and supports queue discard', async () => {
    const queueItems: OfflineQueueItem[] = [
      {
        id: 'queue-1',
        action: 'save_reading_state',
        uid: 'u1',
        payload: {
          selectedBookId: 'b1',
          sessionBookId: 'b1',
          startPage: 1,
          endPage: 4,
          elapsedSeconds: 90,
          sessionStartedAt: '2026-01-01T00:00:00.000Z',
          running: true,
          persistedAt: '2026-01-01T00:01:00.000Z',
        },
        createdAt: '2026-01-01T00:01:00.000Z',
      },
    ]
    const conflicts: OfflineConflictItem[] = [
      {
        id: 'finish:tx-1',
        action: 'finish_reading_session',
        uid: 'u1',
        payload: {
          transactionId: 'tx-1',
          bookId: 'b1',
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-01-01T00:10:00.000Z',
          durationSeconds: 600,
          startPage: 10,
          endPage: 20,
          pagesRead: 10,
          totalPages: 300,
          currentPage: 20,
          status: 'reading',
        },
        createdAt: '2026-01-01T00:10:00.000Z',
        failedAt: '2026-01-01T00:10:01.000Z',
        errorMessage: 'permission',
        retryCount: 1,
        status: 'open',
        nextRetryAt: '2026-01-01T00:11:00.000Z',
      },
    ]

    mockOfflineQueueService.getOfflineQueueItems.mockReturnValue(queueItems)
    mockOfflineQueueService.getOfflineConflicts.mockReturnValue(conflicts)
    mockOfflineQueueService.getOfflineQueueCount.mockReturnValue(queueItems.length)
    mockOfflineQueueService.getOfflineConflictCount.mockReturnValue(conflicts.length)

    const wrapper = mount(SyncCenterView, {
      global: {
        plugins: [makeI18n()],
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Centro de sincronizacion')
    expect(wrapper.text()).toContain('Cola pendiente')
    expect(wrapper.text()).toContain('Conflictos')

    const buttons = wrapper.findAll('button')
    const discardQueueButton = buttons[3]
    if (!discardQueueButton) {
      throw new Error('missing discard queue button')
    }
    await discardQueueButton.trigger('click')
    expect(mockOfflineQueueService.removeOfflineQueueItem).toHaveBeenCalledWith('queue-1')
  })

  it('forces conflict retry from action button', async () => {
    const queueItems: OfflineQueueItem[] = []
    const conflicts: OfflineConflictItem[] = [
      {
        id: 'finish:tx-retry',
        action: 'finish_reading_session',
        uid: 'u1',
        payload: {
          transactionId: 'tx-retry',
          bookId: 'b1',
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-01-01T00:10:00.000Z',
          durationSeconds: 600,
          startPage: 10,
          endPage: 20,
          pagesRead: 10,
          totalPages: 300,
          currentPage: 20,
          status: 'reading',
        },
        createdAt: '2026-01-01T00:10:00.000Z',
        failedAt: '2026-01-01T00:10:01.000Z',
        errorMessage: 'permission',
        retryCount: 1,
        status: 'open',
        nextRetryAt: '2026-01-01T00:11:00.000Z',
      },
    ]

    mockOfflineQueueService.getOfflineQueueItems.mockReturnValue(queueItems)
    mockOfflineQueueService.getOfflineConflicts.mockReturnValue(conflicts)
    mockOfflineQueueService.getOfflineQueueCount.mockReturnValue(queueItems.length)
    mockOfflineQueueService.getOfflineConflictCount.mockReturnValue(conflicts.length)

    const wrapper = mount(SyncCenterView, {
      global: {
        plugins: [makeI18n()],
      },
    })
    await flushPromises()

    const buttons = wrapper.findAll('button')
    const retryConflictButton = buttons[2]
    if (!retryConflictButton) {
      throw new Error('missing retry conflict button')
    }
    await retryConflictButton.trigger('click')

    expect(mockOfflineQueueService.requeueOfflineConflictById).toHaveBeenCalledWith('finish:tx-retry', true)
    expect(mockOfflineQueueService.replayOfflineQueue).toHaveBeenCalled()
  })
})
