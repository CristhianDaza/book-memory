<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PromptModal from '../../../components/PromptModal.vue'
import { enqueueOfflineFinishReadingSession } from '../../../services/offlineQueueService'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'
import { useReadingStore } from '../../../stores/reading'
import { useSessionsStore } from '../../../stores/sessions'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const booksStore = useBooksStore()
const readingStore = useReadingStore()
const sessionsStore = useSessionsStore()
const notificationsStore = useNotificationsStore()

const { user } = storeToRefs(authStore)
const { library } = storeToRefs(booksStore)
const { selectedBookId, sessionBookId, startPage, elapsedSeconds, running, hasActiveSession, sessionStartedAt } =
  storeToRefs(readingStore)

const saving = ref(false)
const localError = ref<string | null>(null)
const showFinishModal = ref(false)
const finishEndPage = ref<string>('0')

const selectedBook = computed(() => library.value.find((book) => book.id === selectedBookId.value) ?? null)
const activeSessionBook = computed(() =>
  sessionBookId.value ? library.value.find((book) => book.id === sessionBookId.value) ?? null : null,
)
const effectiveSessionBook = computed(() => activeSessionBook.value ?? selectedBook.value)
const formattedElapsed = computed(() => {
  const total = elapsedSeconds.value
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const finishEndPageNumber = computed(() => {
  const parsed = Number(finishEndPage.value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
})

const remainingPages = computed(() => {
  if (!effectiveSessionBook.value?.totalPages) return null
  return Math.max(0, effectiveSessionBook.value.totalPages - finishEndPageNumber.value)
})

const remainingPercent = computed(() => {
  if (!effectiveSessionBook.value?.totalPages) return null
  const total = effectiveSessionBook.value.totalPages
  if (total <= 0) return null
  const remaining = Math.max(0, total - finishEndPageNumber.value)
  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)))
})

watch(selectedBook, (book) => {
  if (!book) return
  if (!hasActiveSession.value && startPage.value === 0) {
    readingStore.setStartPage(book.currentPage)
    readingStore.setEndPage(book.currentPage)
  }
})

async function loadContext() {
  await booksStore.ensureLibraryLoaded()

  const fromQuery = typeof route.query.bookId === 'string' ? route.query.bookId : ''
  const initialBookId = fromQuery || library.value[0]?.id || ''
  if (initialBookId) readingStore.setSelectedBook(initialBookId)
}

function onSelectBook(bookId: string) {
  if (hasActiveSession.value) return
  readingStore.setSelectedBook(bookId)
  const selected = library.value.find((book) => book.id === bookId)
  if (!hasActiveSession.value && selected) {
    readingStore.setStartPage(selected.currentPage)
    readingStore.setEndPage(selected.currentPage)
  }
}

function onStart() {
  localError.value = null
  if (!selectedBook.value) {
    localError.value = t('reading.errorNoBook')
    notificationsStore.error(localError.value)
    return
  }
  readingStore.startTimer()
  notificationsStore.info(t('notifications.readingStarted'))
}

function onPause() {
  readingStore.pauseTimer()
  notificationsStore.info(t('notifications.readingPaused'))
}

function onReset() {
  readingStore.resetSession()
  if (selectedBook.value) {
    readingStore.setStartPage(selectedBook.value.currentPage)
    readingStore.setEndPage(selectedBook.value.currentPage)
  }
  notificationsStore.info(t('notifications.readingReset'))
}

function onOpenFinish() {
  localError.value = null
  if (!effectiveSessionBook.value || !user.value?.uid) {
    localError.value = t('reading.errorNoBook')
    notificationsStore.error(localError.value)
    return
  }
  if (!sessionStartedAt.value) {
    localError.value = t('reading.errorNoActive')
    notificationsStore.error(localError.value)
    return
  }
  finishEndPage.value = String(Math.max(startPage.value, effectiveSessionBook.value.currentPage))
  showFinishModal.value = true
}

function onCancelFinish() {
  showFinishModal.value = false
}

function createTransactionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

function isOfflineQueueCandidate(error: unknown): boolean {
  if (isNavigatorOffline()) return true
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  const code = (candidate.code ?? '').toLowerCase()
  const message = (candidate.message ?? '').toLowerCase()
  return (
    code.includes('unavailable') ||
    code.includes('network') ||
    code.includes('timeout') ||
    code.includes('deadline-exceeded') ||
    message.includes('network') ||
    message.includes('offline') ||
    message.includes('timeout')
  )
}

function finishSessionQueuedOffline(
  uid: string,
  bookId: string,
  startedAtIso: string,
  endedAtIso: string,
  durationSeconds: number,
  start: number,
  end: number,
  totalPages: number | null,
) {
  const status = totalPages !== null && end >= totalPages ? ('finished' as const) : ('reading' as const)

  enqueueOfflineFinishReadingSession(uid, {
    transactionId: createTransactionId(),
    bookId,
    startedAt: startedAtIso,
    endedAt: endedAtIso,
    durationSeconds,
    startPage: start,
    endPage: end,
    pagesRead: Math.max(0, end - start),
    totalPages,
    currentPage: end,
    status,
  })

  // Close UI first so offline save feels immediate and deterministic.
  readingStore.resetSession()
  showFinishModal.value = false
  notificationsStore.success(t('notifications.readingSessionQueuedOffline'))

  // Best-effort optimistic metadata update; queue flow is already persisted above.
  void booksStore
    .updateBookMetadata(bookId, {
      totalPages,
      currentPage: end,
      status,
    })
    .catch(() => {})

  void router.push({ name: 'book-detail', params: { id: bookId } }).catch(() => {})
}

async function onConfirmFinish() {
  localError.value = null
  if (!effectiveSessionBook.value || !user.value?.uid) {
    localError.value = t('reading.errorNoBook')
    notificationsStore.error(localError.value)
    return
  }
  const uid = user.value.uid

  const start = Math.max(0, Math.floor(startPage.value))
  const end = finishEndPageNumber.value
  if (end < start) {
    localError.value = t('reading.errorEndBeforeStart')
    notificationsStore.error(localError.value)
    return
  }
  if (!sessionStartedAt.value) {
    localError.value = t('reading.errorNoActive')
    notificationsStore.error(localError.value)
    return
  }
  const now = new Date()
  const startedAtIso = sessionStartedAt.value.toISOString()
  const endedAtIso = now.toISOString()
  const bookId = effectiveSessionBook.value.id
  const totalPages = effectiveSessionBook.value.totalPages
  const durationSeconds = elapsedSeconds.value

  saving.value = true
  try {
    readingStore.pauseTimer()
    if (isNavigatorOffline()) {
      finishSessionQueuedOffline(uid, bookId, startedAtIso, endedAtIso, durationSeconds, start, end, totalPages)
      return
    }
    const pagesRead = Math.max(0, end - start)
    readingStore.setEndPage(end)
    await withTimeout(
      sessionsStore.createSession({
        bookId,
        startedAt: new Date(startedAtIso),
        endedAt: now,
        durationSeconds,
        startPage: start,
        endPage: end,
        pagesRead,
      }),
      8000,
      'network_timeout',
    )

    const status =
      totalPages !== null && end >= totalPages ? ('finished' as const) : ('reading' as const)

    await withTimeout(
      booksStore.updateBookMetadata(bookId, {
        totalPages,
        currentPage: end,
        status,
      }),
      5000,
      'network_timeout',
    )

    readingStore.resetSession()
    showFinishModal.value = false
    notificationsStore.success(t('notifications.readingSessionSaved'))
    void router.push({ name: 'book-detail', params: { id: bookId } }).catch(() => {})
  } catch (error) {
    if (isOfflineQueueCandidate(error)) {
      finishSessionQueuedOffline(uid, bookId, startedAtIso, endedAtIso, durationSeconds, start, end, totalPages)
      return
    }
    localError.value = error instanceof Error ? error.message : t('reading.errorSaveSession')
    notificationsStore.error(localError.value)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await readingStore.hydrateFromCloud()
  await loadContext()
})
</script>

<template>
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">
      {{ t('modules.readingLabel') }}
    </p>
    <h1 class="mt-2 text-2xl font-semibold text-white">
      {{ t('reading.title') }}
    </h1>
    <p class="mt-2 text-sm text-slate-300">
      {{ t('reading.subtitle') }}
    </p>

    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="text-xs text-slate-300">
        {{ t('reading.selectBook') }}
        <select
          v-model="selectedBookId"
          class="mt-1 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
          :disabled="hasActiveSession"
          @change="onSelectBook(selectedBookId)"
        >
          <option
            v-for="book in library"
            :key="book.id"
            :value="book.id"
          >
            {{ book.title }}
          </option>
        </select>
        <p
          v-if="hasActiveSession && activeSessionBook"
          class="mt-1 text-[11px] text-slate-400"
        >
          {{ t('reading.lockedBookHint', { title: activeSessionBook.title }) }}
        </p>
      </label>

      <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <p class="text-xs uppercase tracking-wide text-slate-400">
          {{ t('reading.timer') }}
        </p>
        <p class="mt-1 font-mono text-2xl font-semibold text-cyan-300">
          {{ formattedElapsed }}
        </p>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-1 gap-3">
      <label class="text-xs text-slate-300">
        {{ t('reading.startPage') }}
        <input
          :value="startPage"
          type="number"
          min="0"
          class="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
          @input="readingStore.setStartPage(Number(($event.target as HTMLInputElement).value))"
        >
      </label>
    </div>

    <p
      v-if="localError"
      class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200"
    >
      {{ localError }}
    </p>

    <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        class="cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="running"
        @click="onStart"
      >
        {{ hasActiveSession ? t('reading.resume') : t('reading.start') }}
      </button>

      <button
        type="button"
        class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!running"
        @click="onPause"
      >
        {{ t('reading.pause') }}
      </button>

      <button
        type="button"
        class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!hasActiveSession || saving"
        @click="onReset"
      >
        {{ t('reading.reset') }}
      </button>

      <button
        type="button"
        class="cursor-pointer rounded-xl border border-emerald-500/60 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!hasActiveSession || saving"
        @click="onOpenFinish"
      >
        {{ saving ? t('reading.savingSession') : t('reading.finish') }}
      </button>
    </div>

    <PromptModal
      :open="showFinishModal"
      :title="t('reading.finishStepTitle')"
      :message="t('reading.finishStepSubtitle')"
      :confirm-label="saving ? t('reading.savingSession') : t('reading.confirmFinish')"
      :cancel-label="t('reading.cancelFinish')"
      :value="finishEndPage"
      :input-label="t('reading.endPage')"
      input-type="number"
      input-min="0"
      :loading="saving"
      @cancel="onCancelFinish"
      @confirm="onConfirmFinish"
      @update:value="finishEndPage = $event"
    >
      <template #details>
        <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
          <p>
            {{ t('reading.remainingPages') }}:
            {{ remainingPages === null ? t('reading.unknownRemaining') : remainingPages }}
          </p>
          <p class="mt-1">
            {{ t('reading.remainingPercent') }}:
            {{ remainingPercent === null ? t('reading.unknownRemaining') : `${remainingPercent}%` }}
          </p>
        </div>
      </template>
    </PromptModal>
  </section>
</template>
