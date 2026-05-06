<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { BookOpen, Pause, Play, RotateCcw, TimerReset } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PromptModal from '../../../components/PromptModal.vue'
import { enqueueOfflineFinishReadingSession } from '../../../services/offlineQueueService'
import { useBookCompletionOverlay } from '../../../composables/useBookCompletionOverlay'
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

const { showBookCompletion } = useBookCompletionOverlay()

const saving = ref(false)
const localError = ref<string | null>(null)
const showFinishModal = ref(false)
const finishEndPage = ref<string>('0')
const bookSelectionLockedByRoute = ref(false)

const routeBookId = computed(() => (typeof route.query.bookId === 'string' ? route.query.bookId : ''))
const selectedBook = computed(() => library.value.find((book) => book.id === selectedBookId.value) ?? null)
const activeSessionBook = computed(() =>
  sessionBookId.value ? library.value.find((book) => book.id === sessionBookId.value) ?? null : null,
)
const effectiveSessionBook = computed(() => activeSessionBook.value ?? selectedBook.value)

const availableBooksForReading = computed(() =>
  library.value.filter(
    (book) =>
      book.status === 'reading' &&
      (book.totalPages === null || book.currentPage < book.totalPages),
  ),
)

const isSelectedBookAvailable = computed(() => {
  if (!selectedBook.value) return false
  return availableBooksForReading.value.some((book) => book.id === selectedBook.value!.id)
})
const formattedElapsed = computed(() => {
  const total = elapsedSeconds.value
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const startPageInput = computed(() => {
  if (!selectedBook.value) return ''
  return startPage.value > 0 ? String(startPage.value) : ''
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

const canStartReading = computed(() => {
  const book = selectedBook.value
  if (!book) return false
  if (book.status === 'finished') return false
  if (book.totalPages !== null && book.currentPage >= book.totalPages) return false
  return true
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
  bookSelectionLockedByRoute.value = routeBookId.value.length > 0

  if (hasActiveSession.value && sessionBookId.value) {
    readingStore.setSelectedBook(sessionBookId.value)
    return
  }

  const initialBookId = routeBookId.value || library.value[0]?.id || ''
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

function onOpenBookDetail(bookId: string) {
  void router.push({ name: 'book-detail', params: { id: bookId } }).catch(() => {})
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
  const bookTitle = effectiveSessionBook.value?.title
  const bookAuthors = effectiveSessionBook.value?.authors ?? []
  const bookCoverUrl = effectiveSessionBook.value?.coverUrl ?? null

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

  readingStore.resetSession()
  showFinishModal.value = false
  notificationsStore.success(t('notifications.readingSessionQueuedOffline'))

  void booksStore
    .updateBookMetadata(bookId, {
      totalPages,
      currentPage: end,
      status,
    })
    .catch(() => {})

  if (status === 'finished') {
    showBookCompletion({
      bookId,
      title: bookTitle ?? '',
      authors: bookAuthors,
      coverUrl: bookCoverUrl,
    })
  }

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

    const bookTitle = effectiveSessionBook.value?.title
    const bookAuthors = effectiveSessionBook.value?.authors ?? []
    const bookCoverUrl = effectiveSessionBook.value?.coverUrl ?? null

    await withTimeout(
      booksStore.updateBookMetadata(bookId, {
        totalPages,
        currentPage: end,
        status,
      }),
      5000,
      'network_timeout',
    )

    if (status === 'finished') {
      showBookCompletion({
        bookId,
        title: bookTitle ?? '',
        authors: bookAuthors,
        coverUrl: bookCoverUrl,
      })
    }

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
  <section class="bm-panel">
    <p class="bm-eyebrow">{{ t('modules.readingLabel') }}</p>
    <h1 class="bm-title mt-2">{{ t('reading.title') }}</h1>
    <p class="bm-muted mt-2 text-sm">{{ t('reading.subtitle') }}</p>

    <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="space-y-3">
        <label
          v-if="!bookSelectionLockedByRoute"
          class="bm-label"
        >
          {{ t('reading.selectBook') }}
          <select
            v-model="selectedBookId"
            class="bm-select mt-1 text-sm"
            :disabled="hasActiveSession"
            @change="onSelectBook(selectedBookId)"
          >
            <option
              v-for="book in availableBooksForReading"
              :key="book.id"
              :value="book.id"
            >
              {{ book.title }}
            </option>
          </select>
          <span
            v-if="hasActiveSession && activeSessionBook"
            class="bm-soft mt-1 text-[11px]"
          >
            {{ t('reading.lockedBookHint', { title: activeSessionBook.title }) }}
          </span>
        </label>

        <button
          v-if="effectiveSessionBook && (bookSelectionLockedByRoute || isSelectedBookAvailable)"
          type="button"
          class="bm-subtle-panel flex w-full cursor-pointer items-center gap-3 text-left transition hover:border-(--app-primary) hover:bg-(--app-surface-raised)"
          @click="onOpenBookDetail(effectiveSessionBook.id)"
        >
          <div class="h-24 w-16 flex-none overflow-hidden rounded-lg border border-(--app-border) bg-(--app-surface-raised)">
            <img
              v-if="effectiveSessionBook.coverUrl"
              :src="effectiveSessionBook.coverUrl"
              :alt="effectiveSessionBook.title"
              class="h-full w-full object-cover"
            >
            <div
              v-else
              class="grid h-full w-full place-items-center text-(--app-text-soft)"
              :aria-label="t('books.noCover')"
            >
              <BookOpen
                :size="24"
                aria-hidden="true"
              />
            </div>
          </div>

          <div class="min-w-0">
            <p class="text-sm font-extrabold leading-tight text-(--app-text)">
              {{ effectiveSessionBook.title }}
            </p>
            <p class="mt-1 truncate text-xs text-(--app-text-muted)">
              {{ effectiveSessionBook.authors.join(', ') || t('books.unknownAuthor') }}
            </p>
            <p class="mt-2 text-[11px] font-bold text-(--app-text-soft)">
              {{ t('books.progress') }}: {{ effectiveSessionBook.currentPage }} /
              {{ effectiveSessionBook.totalPages ?? t('reading.unknownRemaining') }}
            </p>
          </div>
        </button>

        <p
          v-else-if="!bookSelectionLockedByRoute"
          class="bm-soft mt-2 text-sm"
        >
          {{ t('reading.selectBook') }}
        </p>

        <label class="bm-label">
          {{ t('reading.startPage') }}
          <input
            :value="startPageInput"
            type="number"
            min="0"
            class="bm-input mt-1 text-sm"
            @input="readingStore.setStartPage(Number(($event.target as HTMLInputElement).value))"
          >
        </label>
      </div>

      <div class="bm-subtle-panel flex min-h-56 flex-col items-center justify-center text-center">
        <TimerReset
          :size="28"
          class="text-(--app-primary-strong)"
          aria-hidden="true"
        />
        <p class="bm-eyebrow mt-3">{{ t('reading.timer') }}</p>
        <p class="mt-2 font-mono text-4xl font-black text-(--app-text)">{{ formattedElapsed }}</p>
      </div>
    </div>

    <p
      v-if="localError"
      class="mt-3 rounded-lg border border-(--app-danger) bg-(--app-danger-soft) p-2 text-xs text-(--app-danger)"
    >
      {{ localError }}
    </p>

    <div class="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        class="bm-button bm-button-primary"
        :disabled="running || !canStartReading"
        @click="onStart"
      >
        <Play
          :size="17"
          aria-hidden="true"
        />
        {{ hasActiveSession ? t('reading.resume') : t('reading.start') }}
      </button>

      <button
        type="button"
        class="bm-button"
        :disabled="!running"
        @click="onPause"
      >
        <Pause
          :size="17"
          aria-hidden="true"
        />
        {{ t('reading.pause') }}
      </button>

      <button
        type="button"
        class="bm-button"
        :disabled="!hasActiveSession || saving"
        @click="onReset"
      >
        <RotateCcw
          :size="17"
          aria-hidden="true"
        />
        {{ t('reading.reset') }}
      </button>

      <button
        type="button"
        class="bm-button bm-button-success"
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
        <div class="bm-subtle-panel mt-3 text-sm">
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
