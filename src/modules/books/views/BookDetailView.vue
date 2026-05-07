<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowLeft, BookOpen, Heart, Pencil, Play, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ConfirmModal from '../../../components/ConfirmModal.vue'
import { useBookCompletionOverlay } from '../../../composables/useBookCompletionOverlay'
import IconButton from '../../../components/ui/IconButton.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import StarRating from '../../../components/ui/StarRating.vue'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'
import { useSessionsStore } from '../../../stores/sessions'
import type { ReadingSessionRecord } from '../../../types/reading'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const authStore = useAuthStore()
const sessionsStore = useSessionsStore()
const notificationsStore = useNotificationsStore()

const { favoriteUpdatingIds, metadataUpdatingIds, deletingIds, syncQueuedMessageKey } = storeToRefs(booksStore)
const { user } = storeToRefs(authStore)
const { showBookCompletion } = useBookCompletionOverlay()

const bookId = computed(() => String(route.params.id ?? ''))
const book = computed(() => booksStore.getLibraryBookById(bookId.value))
const editMode = ref(false)
const formTotalPages = ref<string>('')
const formCurrentPage = ref<string>('0')
const formCoverUrl = ref<string>('')
const formStatus = ref<'reading' | 'finished' | 'wishlist' | 'paused' | 'abandoned'>('reading')
const formRating = ref<1 | 2 | 3 | 4 | 5 | null>(null)
const formNote = ref<string>('')
const formAbandonedReason = ref<string>('')
const sessions = ref<ReadingSessionRecord[]>([])
const loadingSessions = ref(false)
const visibleSessionsCount = ref(5)
const editingSessionId = ref<string | null>(null)
const editingSessionStartPage = ref<string>('0')
const editingSessionEndPage = ref<string>('0')
const editingSessionDurationMinutes = ref<string>('0')
const savingSessionEdit = ref(false)
const deletingSessionId = ref<string | null>(null)
const removingBookModalOpen = ref(false)
const removingSessionId = ref<string | null>(null)
const showCompletionRatingModal = ref(false)
const completionRating = ref<1 | 2 | 3 | 4 | 5 | null>(null)
const completionNote = ref('')
const completionRatingError = ref('')
const canEditRating = computed(() => formStatus.value === 'finished')
const showRatingDisplay = computed(() => Boolean(book.value && book.value.status === 'finished' && book.value.rating))

function isFavoriteUpdating() {
  return favoriteUpdatingIds.value.includes(bookId.value)
}

function isDeleting() {
  return deletingIds.value.includes(bookId.value)
}

function isMetadataUpdating() {
  return metadataUpdatingIds.value.includes(bookId.value)
}

const displayCurrentPage = computed(() => {
  if (!book.value) return 0
  if (book.value.status === 'finished' && book.value.totalPages !== null) return book.value.totalPages
  return book.value.currentPage
})

const remainingPages = computed(() => {
  if (!book.value?.totalPages) return null
  return Math.max(0, book.value.totalPages - displayCurrentPage.value)
})
const validSessionsForPace = computed(() =>
  sessions.value.filter((session) => (session.pagesRead ?? 0) > 0 && (session.durationSeconds ?? 0) > 0),
)
const totalPagesRead = computed(() =>
  validSessionsForPace.value.reduce((acc, session) => acc + Math.max(0, session.pagesRead ?? 0), 0),
)
const totalMinutesRead = computed(() =>
  Math.floor(validSessionsForPace.value.reduce((acc, session) => acc + Math.max(0, session.durationSeconds ?? 0), 0) / 60),
)
const minutesPerPage = computed(() => {
  if (totalPagesRead.value <= 0) return null
  return totalMinutesRead.value / totalPagesRead.value
})
const minutesPerPageDisplay = computed(() => {
  if (minutesPerPage.value === null) return null
  return (Math.round(minutesPerPage.value * 10) / 10).toFixed(1)
})
const minutesPerTenPagesDisplay = computed(() => {
  if (minutesPerPage.value === null) return null
  return (Math.round(minutesPerPage.value * 100) / 10).toFixed(1)
})
const estimatedRemainingMinutesDisplay = computed(() => {
  if (minutesPerPage.value === null || remainingPages.value === null) return null
  return (Math.round(remainingPages.value * minutesPerPage.value * 10) / 10).toFixed(1)
})
const visibleSessions = computed(() => sessions.value.slice(0, visibleSessionsCount.value))
const canLoadMoreSessions = computed(() => sessions.value.length > visibleSessionsCount.value)

function showQueuedFeedbackIfAny() {
  if (!syncQueuedMessageKey.value) return
  notificationsStore.info(t(syncQueuedMessageKey.value))
  booksStore.clearSyncQueuedMessage()
}

async function onToggleFavorite() {
  if (!book.value) return
  await booksStore.toggleFavorite(book.value.id)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  showQueuedFeedbackIfAny()
  notificationsStore.success(
    book.value.favorite ? t('notifications.bookMarkedFavorite') : t('notifications.bookUnmarkedFavorite'),
  )
}

function onRequestRemoveBook() {
  if (!book.value) return
  removingBookModalOpen.value = true
}

function onCancelRemoveBook() {
  removingBookModalOpen.value = false
}

async function onConfirmRemoveBook() {
  if (!book.value) return

  await booksStore.removeFromLibrary(book.value.id)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  showQueuedFeedbackIfAny()
  notificationsStore.success(t('notifications.bookRemoved'))
  removingBookModalOpen.value = false
  await router.push({ name: 'books' })
}

async function loadSessions() {
  if (!book.value || !user.value?.uid) {
    sessions.value = []
    return
  }

  loadingSessions.value = true
  try {
    sessions.value = await sessionsStore.ensureBookSessionsLoaded(book.value.id)
    visibleSessionsCount.value = 5
  } catch {
    sessions.value = []
  } finally {
    loadingSessions.value = false
  }
}

function syncFormFromBook() {
  if (!book.value) return
  formTotalPages.value = book.value.totalPages?.toString() ?? ''
  formCurrentPage.value = String(displayCurrentPage.value)
  formCoverUrl.value = book.value.coverUrl ?? ''
  formStatus.value = book.value.status
  formRating.value = book.value.rating
  formNote.value = book.value.note ?? ''
  formAbandonedReason.value = book.value.abandonedReason ?? ''
}

function syncFinishedProgressField() {
  if (formStatus.value !== 'finished') return
  const parsedTotalPages = Number(formTotalPages.value)
  if (!Number.isFinite(parsedTotalPages) || parsedTotalPages <= 0) return
  formCurrentPage.value = String(Math.floor(parsedTotalPages))
}

function onStartEdit() {
  syncFormFromBook()
  editMode.value = true
}

function onCancelEdit() {
  editMode.value = false
  syncFormFromBook()
}

async function onSaveMetadata() {
  if (!book.value) return

  const parsedTotalPages = String(formTotalPages.value).trim() === '' ? null : Number(formTotalPages.value)
  const parsedCurrentPage = Number(formCurrentPage.value)
  const safeCurrentPage = Number.isFinite(parsedCurrentPage) && parsedCurrentPage >= 0 ? parsedCurrentPage : 0
  const safeTotalPages = parsedTotalPages !== null && Number.isFinite(parsedTotalPages) && parsedTotalPages > 0
    ? Math.floor(parsedTotalPages)
    : null
  const safeCoverUrl = book.value.coverUrl ?? (formCoverUrl.value.trim() || null)

  const currentPageCapped =
    safeTotalPages !== null ? Math.min(Math.floor(safeCurrentPage), safeTotalPages) : Math.floor(safeCurrentPage)

  const previousStatus = book.value.status
  const nextAbandonedReason = formStatus.value === 'abandoned' ? (formAbandonedReason.value.trim() || null) : null

  let nextCurrentPage: number
  if (formStatus.value === 'finished' && safeTotalPages !== null) {
    nextCurrentPage = safeTotalPages
  } else if (previousStatus === 'finished' && formStatus.value !== 'finished' && safeTotalPages !== null && currentPageCapped >= safeTotalPages) {
    nextCurrentPage = Math.max(0, safeTotalPages - 1)
  } else {
    nextCurrentPage = currentPageCapped
  }

  const isTransitionToFinished = previousStatus !== 'finished' && formStatus.value === 'finished'

  if (isTransitionToFinished) {
    completionRating.value = formRating.value ?? book.value.rating
    completionNote.value = formNote.value || book.value.note || ''
    completionRatingError.value = ''
    showCompletionRatingModal.value = true
    return
  }

  await booksStore.updateBookMetadata(book.value.id, {
    coverUrl: safeCoverUrl,
    totalPages: safeTotalPages,
    currentPage: nextCurrentPage,
    status: formStatus.value,
    rating: formRating.value,
    note: formNote.value.trim() || null,
    abandonedReason: nextAbandonedReason,
    rating: formRating.value,
    note: formNote.value.trim() || null,
    abandonedReason: nextAbandonedReason,
  })
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }

  syncFormFromBook()
  showQueuedFeedbackIfAny()
  editMode.value = false
  notificationsStore.success(t('notifications.metadataSaved'))
}

function onCancelCompletionRating() {
  showCompletionRatingModal.value = false
  completionRatingError.value = ''
}

async function onConfirmCompletionRating() {
  if (!book.value) return
  if (!completionRating.value) {
    completionRatingError.value = t('books.ratingRequired')
    return
  }

  const parsedTotalPages = String(formTotalPages.value).trim() === '' ? null : Number(formTotalPages.value)
  const parsedCurrentPage = Number(formCurrentPage.value)
  const safeCurrentPage = Number.isFinite(parsedCurrentPage) && parsedCurrentPage >= 0 ? parsedCurrentPage : 0
  const safeTotalPages = parsedTotalPages !== null && Number.isFinite(parsedTotalPages) && parsedTotalPages > 0
    ? Math.floor(parsedTotalPages)
    : null
  const safeCoverUrl = book.value.coverUrl ?? (formCoverUrl.value.trim() || null)
  const currentPageCapped =
    safeTotalPages !== null ? Math.min(Math.floor(safeCurrentPage), safeTotalPages) : Math.floor(safeCurrentPage)

  await booksStore.updateBookMetadata(book.value.id, {
    coverUrl: safeCoverUrl,
    totalPages: safeTotalPages,
    currentPage: safeTotalPages ?? currentPageCapped,
    status: 'finished',
    rating: completionRating.value,
    note: completionNote.value.trim() || null,
  })
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }

  formRating.value = completionRating.value
  formNote.value = completionNote.value
  formStatus.value = 'finished'
  syncFormFromBook()
  showQueuedFeedbackIfAny()
  showCompletionRatingModal.value = false
  editMode.value = false
  showBookCompletion({
    bookId: book.value.id,
    title: book.value.title,
    authors: book.value.authors,
    coverUrl: book.value.coverUrl ?? null,
  })
  notificationsStore.success(t('notifications.metadataSaved'))
}

const canStartReadingSession = computed(() => {
  if (!book.value) return false
  if (book.value.status !== 'reading') return false
  if (book.value.totalPages !== null && book.value.currentPage >= book.value.totalPages) return false
  return true
})

async function onStartReadingSession() {
  if (!canStartReadingSession.value) return
  if (!book.value) return
  await router.push({ name: 'reading', query: { bookId: book.value.id } })
}

function formatSessionDate(value: unknown): string {
  if (!value) return '—'
  if (typeof value === 'object' && 'toDate' in value) {
    const converted = (value as { toDate: () => Date }).toDate()
    return converted.toLocaleDateString()
  }
  if (value instanceof Date) return value.toLocaleDateString()
  return '—'
}

function onLoadMoreSessions() {
  visibleSessionsCount.value += 5
}

function onStartEditSession(session: ReadingSessionRecord) {
  editingSessionId.value = session.id
  editingSessionStartPage.value = String(session.startPage ?? 0)
  editingSessionEndPage.value = String(session.endPage ?? 0)
  editingSessionDurationMinutes.value = String(Math.floor((session.durationSeconds ?? 0) / 60))
}

function onCancelEditSession() {
  editingSessionId.value = null
}

async function onSaveEditSession(sessionId: string) {
  if (!book.value || !user.value?.uid) return

  const start = Math.max(0, Math.floor(Number(editingSessionStartPage.value)))
  const end = Math.max(0, Math.floor(Number(editingSessionEndPage.value)))
  const minutes = Math.max(0, Math.floor(Number(editingSessionDurationMinutes.value)))

  if (end < start) return

  savingSessionEdit.value = true
  try {
    await sessionsStore.updateSession(sessionId, {
      startPage: start,
      endPage: end,
      pagesRead: Math.max(0, end - start),
      durationSeconds: minutes * 60,
    })
    editingSessionId.value = null
    sessions.value = sessionsStore.getSessionsForBook(book.value.id)
    await booksStore.recalculateBookProgressFromSessions(book.value.id)
    if (booksStore.errorKey) {
      notificationsStore.error(t(booksStore.errorKey))
      return
    }
    notificationsStore.success(t('notifications.sessionUpdated'))
  } catch {
    notificationsStore.error(t('notifications.sessionUpdateError'))
  } finally {
    savingSessionEdit.value = false
  }
}

function onRequestDeleteSession(sessionId: string) {
  removingSessionId.value = sessionId
}

function onCancelDeleteSession() {
  removingSessionId.value = null
}

async function onConfirmDeleteSession() {
  if (!book.value || !user.value?.uid) return
  if (!removingSessionId.value) return

  deletingSessionId.value = removingSessionId.value
  try {
    await sessionsStore.deleteSession(removingSessionId.value)
    sessions.value = sessionsStore.getSessionsForBook(book.value.id)
    await booksStore.recalculateBookProgressFromSessions(book.value.id)
    if (booksStore.errorKey) {
      notificationsStore.error(t(booksStore.errorKey))
      return
    }
    notificationsStore.success(t('notifications.sessionRemoved'))
    removingSessionId.value = null
  } catch {
    notificationsStore.error(t('notifications.sessionRemoveError'))
  } finally {
    deletingSessionId.value = null
  }
}

watch(
  () => book.value?.id,
  async () => {
    syncFormFromBook()
    editMode.value = false
    await loadSessions()
  },
  { immediate: true },
)

watch([formStatus, formTotalPages], syncFinishedProgressField)

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
  if (bookId.value) booksStore.selectLibraryBook(bookId.value)
})
</script>

<template>
  <section class="bm-panel">
    <template v-if="book">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p class="bm-eyebrow">
          {{ t('books.detailTitle') }}
        </p>
        <RouterLink
          class="bm-button w-full sm:w-fit"
          :to="{ name: 'books' }"
        >
          <ArrowLeft
            :size="17"
            aria-hidden="true"
          />
          {{ t('books.backToLibrary') }}
        </RouterLink>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <div class="mx-auto w-48 lg:mx-0">
          <div class="overflow-hidden rounded-2xl border border-(--app-border) bg-(--app-surface-muted) shadow-lg">
            <img
              v-if="book.coverUrl"
              :src="book.coverUrl"
              :alt="book.title"
              class="aspect-2/3 w-full object-cover"
            >
            <div
              v-else
              class="flex aspect-2/3 w-full items-center justify-center px-3 text-center text-xs text-(--app-text-soft)"
            >
              {{ t('books.noCover') }}
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <h1 class="bm-title">
            {{ book.title }}
          </h1>
          <p class="bm-muted text-sm">
            {{ t('books.by') }} {{ book.authors.join(', ') || t('books.unknownAuthor') }}
          </p>
          <div class="flex flex-wrap gap-2 pt-2">
            <StatusBadge>{{ t('books.source') }}: {{ book.source }}</StatusBadge>
            <StatusBadge>{{ t('books.status') }}: {{ t(`books.status_${book.status}`) }}</StatusBadge>
            <StatusBadge :tone="book.favorite ? 'warning' : 'neutral'">
              {{ book.favorite ? t('books.favorite') : t('books.notFavorite') }}
            </StatusBadge>
          </div>
          <div
            v-if="showRatingDisplay"
            class="mt-2 flex items-center gap-2"
          >
            <span class="bm-muted text-sm">{{ t('books.ratingLabel') }}:</span>
            <StarRating
              :model-value="book.rating"
              readonly
              :size="16"
            />
          </div>

          <div class="bm-subtle-panel mt-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="bm-stat-label">{{ t('books.progress') }}</p>
                <p class="bm-stat-value">
                  {{ displayCurrentPage }}
                  <span class="text-base font-semibold text-(--app-text-muted)">
                    / {{ book.totalPages ?? t('books.unknownPages') }}
                  </span>
                </p>
              </div>
              <BookOpen
                :size="28"
                class="text-(--app-accent-strong)"
                aria-hidden="true"
              />
            </div>
            <div
              v-if="book.totalPages"
              class="bm-progress-track mt-3"
            >
              <div
                class="bm-progress-fill"
                :style="{ width: `${Math.min(100, Math.round((displayCurrentPage / book.totalPages) * 100))}%` }"
              />
            </div>
            <p class="bm-muted mt-2 text-sm">
              {{ t('books.remainingPages') }}:
              {{ remainingPages === null ? t('books.unknownPages') : remainingPages }}
            </p>
          </div>

          <div class="bm-subtle-panel mt-4">
            <p class="bm-eyebrow">{{ t('books.readingPaceTitle') }}</p>
            <p
              v-if="minutesPerPageDisplay === null"
              class="bm-muted mt-2 text-sm"
            >
              {{ t('books.readingPaceNoData') }}
            </p>
            <template v-else>
              <p class="bm-muted mt-2 text-sm">
                {{ t('books.readingPaceMetric') }}: {{ minutesPerPageDisplay }} {{ t('books.readingPaceUnit') }}
              </p>
              <p class="bm-muted mt-1 text-sm">
                {{ t('books.readingPaceTenPages') }}: {{ minutesPerTenPagesDisplay }} {{ t('books.readingMinutesUnit') }}
              </p>
              <p
                v-if="estimatedRemainingMinutesDisplay !== null"
                class="bm-muted mt-1 text-sm"
              >
                {{ t('books.readingPaceEstimatedRemaining') }}:
                {{ estimatedRemainingMinutesDisplay }} {{ t('books.readingMinutesUnit') }}
              </p>
            </template>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-if="canStartReadingSession"
              type="button"
              class="bm-button bm-button-primary"
              @click="onStartReadingSession"
            >
              <Play
                :size="17"
                aria-hidden="true"
              />
              {{ t('books.startSession') }}
            </button>

            <button
              type="button"
              class="bm-button bm-button-warm"
              :disabled="isFavoriteUpdating() || isDeleting()"
              @click="onToggleFavorite"
            >
              <Heart
                :size="17"
                :fill="book.favorite ? 'currentColor' : 'none'"
                aria-hidden="true"
              />
              {{
                isFavoriteUpdating()
                  ? t('books.updatingFavorite')
                  : book.favorite
                    ? t('books.unmarkFavorite')
                    : t('books.markFavorite')
              }}
            </button>

            <button
              type="button"
              class="bm-button bm-button-danger"
              :disabled="isDeleting() || isFavoriteUpdating()"
              @click="onRequestRemoveBook"
            >
              <Trash2
                :size="17"
                aria-hidden="true"
              />
              {{ isDeleting() ? t('books.deletingBook') : t('books.removeBook') }}
            </button>
          </div>

          <div class="bm-subtle-panel mt-4">
            <div class="mb-2 flex items-center justify-between">
              <p class="bm-eyebrow">
                {{ t('books.editMetadata') }}
              </p>
              <IconButton
                v-if="!editMode"
                :label="t('books.editAction')"
                @click="onStartEdit"
              >
                <Pencil
                  :size="16"
                  aria-hidden="true"
                />
              </IconButton>
              </IconButton>
            </div>

            <div
              v-if="!editMode"
              class="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <div class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2">
                <p class="bm-soft text-[11px]">{{ t('books.pages') }}</p>
                <p class="bm-muted text-sm">{{ book.totalPages ?? t('books.unknownPages') }}</p>
              </div>
              <div class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2">
                <p class="bm-soft text-[11px]">{{ t('books.progress') }}</p>
                <p class="bm-muted text-sm">{{ displayCurrentPage }}</p>
              </div>
              <div class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2">
                <p class="bm-soft text-[11px]">{{ t('books.status') }}</p>
                <p class="bm-muted text-sm">{{ t(`books.status_${book.status}`) }}</p>
              </div>
              <div
                v-if="showRatingDisplay"
                class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2"
              >
                <p class="bm-soft text-[11px]">{{ t('books.ratingLabel') }}</p>
                <div class="mt-1">
                  <StarRating
                    :model-value="book.rating"
                    readonly
                    :size="15"
                  />
                </div>
              </div>
              <div
                v-if="!book.coverUrl"
                class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2 sm:col-span-2"
              >
                <p class="bm-soft text-[11px]">{{ t('books.manualCoverUrl') }}</p>
                <p class="bm-muted break-all text-sm">{{ t('books.noCover') }}</p>
              </div>
              <div
                v-if="book.note"
                class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2 sm:col-span-2"
              >
                <p class="bm-soft text-[11px]">{{ t('books.noteLabel') }}</p>
                <p class="bm-muted mt-1 whitespace-pre-line text-sm">{{ book.note }}</p>
              </div>
            </div>

            <template v-else>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label class="bm-label">
                  {{ t('books.pages') }}
                  <input
                    v-model="formTotalPages"
                    type="number"
                    min="1"
                    :disabled="isMetadataUpdating()"
                    class="bm-input mt-1 py-1.5 text-sm"
                  >
                </label>

                <label class="bm-label">
                  {{ t('books.progress') }}
                  <input
                    v-model="formCurrentPage"
                    type="number"
                    min="0"
                    :disabled="isMetadataUpdating()"
                    class="bm-input mt-1 py-1.5 text-sm"
                  >
                </label>

                <label class="bm-label">
                  {{ t('books.status') }}
                  <select
                    v-model="formStatus"
                    :disabled="isMetadataUpdating()"
                    class="bm-select mt-1 py-1.5 text-sm"
                  >
                    <option value="reading">{{ t('books.status_reading') }}</option>
                    <option value="finished">{{ t('books.status_finished') }}</option>
                    <option value="wishlist">{{ t('books.status_wishlist') }}</option>
                    <option value="paused">{{ t('books.status_paused') }}</option>
                    <option value="abandoned">{{ t('books.status_abandoned') }}</option>
                  </select>
                </label>

                <label
                  v-if="formStatus === 'abandoned'"
                  class="bm-label sm:col-span-3"
                >
                  {{ t('books.abandonedReason') }}
                  <textarea
                    v-model="formAbandonedReason"
                    :disabled="isMetadataUpdating()"
                    :placeholder="t('books.abandonedReasonPlaceholder')"
                    class="bm-input mt-1 min-h-20 py-1.5 text-sm"
                  />
                </label>

                <label
                  v-if="canEditRating"
                  class="bm-label sm:col-span-3"
                >
                  {{ t('books.ratingLabel') }}
                  <div class="mt-2">
                    <StarRating
                      v-model="formRating"
                      :readonly="isMetadataUpdating()"
                    />
                  </div>
                </label>

                <label
                  v-if="canEditRating"
                  class="bm-label sm:col-span-3"
                >
                  {{ t('books.noteLabel') }}
                  <textarea
                    v-model="formNote"
                    :disabled="isMetadataUpdating()"
                    :placeholder="t('books.notePlaceholder')"
                    class="bm-input mt-1 min-h-20 py-1.5 text-sm"
                  />
                </label>

                <label
                  v-if="!book.coverUrl"
                  class="bm-label sm:col-span-3"
                >
                  {{ t('books.manualCoverUrl') }}
                  <input
                    v-model="formCoverUrl"
                    type="url"
                    :placeholder="t('books.manualCoverUrlPlaceholder')"
                    :disabled="isMetadataUpdating()"
                    class="bm-input mt-1 py-1.5 text-sm"
                  >
                </label>
              </div>

              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  class="bm-button bm-button-primary"
                  :disabled="isMetadataUpdating()"
                  @click="onSaveMetadata"
                >
                  {{ isMetadataUpdating() ? t('books.savingMetadata') : t('books.saveMetadata') }}
                </button>
                <button
                  type="button"
                  class="bm-button"
                  :disabled="isMetadataUpdating()"
                  @click="onCancelEdit"
                >
                  {{ t('books.cancelEdit') }}
                </button>
              </div>
            </template>
          </div>

          <div
            v-if="book.note"
            class="bm-subtle-panel mt-4"
          >
            <p class="bm-eyebrow">{{ t('books.noteLabel') }}</p>
            <p class="bm-muted mt-2 whitespace-pre-line text-sm">{{ book.note }}</p>
          </div>

          <div class="bm-subtle-panel mt-4">
            <p class="bm-eyebrow">
              {{ t('books.recentSessions') }}
            </p>
            <p
              v-if="loadingSessions"
              class="bm-muted mt-2 text-sm"
            >
              {{ t('books.loadingSessions') }}
            </p>

            <ul
              v-else-if="visibleSessions.length > 0"
              class="mt-2 space-y-2"
            >
              <li
                v-for="session in visibleSessions"
                :key="session.id"
                class="rounded-lg border border-(--app-border) bg-(--app-surface) px-3 py-2 text-xs text-(--app-text-muted)"
              >
                <template v-if="editingSessionId === session.id">
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label>
                      <span class="bm-soft text-[11px]">{{ t('reading.startPage') }}</span>
                      <input
                        v-model="editingSessionStartPage"
                        type="number"
                        min="0"
                        class="bm-input mt-1 py-1 text-xs"
                      >
                    </label>
                    <label>
                      <span class="bm-soft text-[11px]">{{ t('reading.endPage') }}</span>
                      <input
                        v-model="editingSessionEndPage"
                        type="number"
                        min="0"
                        class="bm-input mt-1 py-1 text-xs"
                      >
                    </label>
                    <label>
                      <span class="bm-soft text-[11px]">{{ t('books.sessionDuration') }} (min)</span>
                      <input
                        v-model="editingSessionDurationMinutes"
                        type="number"
                        min="0"
                        class="bm-input mt-1 py-1 text-xs"
                      >
                    </label>
                  </div>
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      class="bm-button bm-button-primary text-xs"
                      :disabled="savingSessionEdit"
                      @click="onSaveEditSession(session.id)"
                    >
                      {{ savingSessionEdit ? t('books.savingMetadata') : t('books.saveSessionEdit') }}
                    </button>
                    <button
                      type="button"
                      class="bm-button text-xs"
                      :disabled="savingSessionEdit"
                      @click="onCancelEditSession"
                    >
                      {{ t('books.cancelEdit') }}
                    </button>
                  </div>
                </template>
                <template v-else>
                  <p>{{ formatSessionDate(session.startedAt) }}</p>
                  <p>
                    {{ t('books.sessionPages') }}:
                    {{ session.pagesRead ?? 0 }}
                  </p>
                  <p>
                    {{ t('books.sessionDuration') }}:
                    {{ Math.floor((session.durationSeconds ?? 0) / 60) }}m
                  </p>
                  <div class="mt-2 flex gap-2">
                    <button
                      type="button"
                      class="bm-button text-[11px]"
                      @click="onStartEditSession(session)"
                    >
                      {{ t('books.editSession') }}
                    </button>
                    <button
                      type="button"
                      class="bm-button bm-button-danger text-[11px]"
                      :disabled="deletingSessionId === session.id"
                      @click="onRequestDeleteSession(session.id)"
                    >
                      {{ deletingSessionId === session.id ? t('books.deletingBook') : t('books.removeSession') }}
                    </button>
                  </div>
                </template>
              </li>
            </ul>

            <p
              v-else
              class="bm-muted mt-2 text-sm"
            >
              {{ t('books.noSessions') }}
            </p>
            <button
              v-if="canLoadMoreSessions"
              type="button"
              class="bm-button mt-2 text-xs"
              @click="onLoadMoreSessions"
            >
              {{ t('books.loadMoreSessions') }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <p class="bm-muted text-sm">
        {{ t('books.notFound') }}
      </p>
      <RouterLink
        class="bm-button mt-4"
        to="/books"
      >
        {{ t('books.backToLibrary') }}
      </RouterLink>
    </template>
  </section>

  <ConfirmModal
    :open="removingBookModalOpen"
    :title="t('books.removeConfirmTitle')"
    :message="t('books.removeConfirmMessage')"
    :confirm-label="t('books.removeBook')"
    :cancel-label="t('common.cancel')"
    :loading="isDeleting()"
    danger
    @cancel="onCancelRemoveBook"
    @confirm="onConfirmRemoveBook"
  />

  <ConfirmModal
    :open="Boolean(removingSessionId)"
    :title="t('books.removeSessionConfirmTitle')"
    :message="t('books.removeSessionConfirmMessage')"
    :confirm-label="t('books.removeSession')"
    :cancel-label="t('common.cancel')"
    :loading="Boolean(deletingSessionId)"
    danger
    @cancel="onCancelDeleteSession"
    @confirm="onConfirmDeleteSession"
  />

  <div
    v-if="showCompletionRatingModal"
    class="bm-modal-backdrop z-50"
  >
    <section class="bm-modal-sheet w-full max-w-lg p-5 sm:p-6">
      <h3 class="bm-section-title">{{ t('books.ratingModalTitle') }}</h3>
      <p class="bm-muted mt-1 text-sm">{{ t('books.ratingModalSubtitle') }}</p>
      <div class="mt-4">
        <p class="bm-label">{{ t('books.ratingLabel') }}</p>
        <StarRating
          v-model="completionRating"
          class="mt-2"
        />
        <p
          v-if="completionRatingError"
          class="mt-2 text-xs text-(--app-danger)"
        >
          {{ completionRatingError }}
        </p>
      </div>
      <label class="bm-label mt-4 block">
        {{ t('books.noteLabel') }}
        <textarea
          v-model="completionNote"
          :placeholder="t('books.notePlaceholder')"
          class="bm-input mt-1 min-h-24 text-sm"
        />
      </label>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="bm-button"
          @click="onCancelCompletionRating"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          type="button"
          class="bm-button bm-button-primary"
          @click="onConfirmCompletionRating"
        >
          {{ t('books.saveRatingAction') }}
        </button>
      </div>
    </section>
  </div>
</template>
