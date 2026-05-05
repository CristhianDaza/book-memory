<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { BookOpen, Heart, Pencil, Play, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ConfirmModal from '../../../components/ConfirmModal.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
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

const bookId = computed(() => String(route.params.id ?? ''))
const book = computed(() => booksStore.getLibraryBookById(bookId.value))
const editMode = ref(false)
const formTotalPages = ref<string>('')
const formCurrentPage = ref<string>('0')
const formStatus = ref<'reading' | 'finished' | 'wishlist'>('reading')
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

function isFavoriteUpdating() {
  return favoriteUpdatingIds.value.includes(bookId.value)
}

function isDeleting() {
  return deletingIds.value.includes(bookId.value)
}

function isMetadataUpdating() {
  return metadataUpdatingIds.value.includes(bookId.value)
}

const remainingPages = computed(() => {
  if (!book.value?.totalPages) return null
  return Math.max(0, book.value.totalPages - book.value.currentPage)
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
  formCurrentPage.value = String(book.value.currentPage ?? 0)
  formStatus.value = book.value.status
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

  const parsedTotalPages = formTotalPages.value.trim() === '' ? null : Number(formTotalPages.value)
  const parsedCurrentPage = Number(formCurrentPage.value)
  const safeCurrentPage = Number.isFinite(parsedCurrentPage) && parsedCurrentPage >= 0 ? parsedCurrentPage : 0
  const safeTotalPages = parsedTotalPages !== null && Number.isFinite(parsedTotalPages) && parsedTotalPages > 0
    ? Math.floor(parsedTotalPages)
    : null

  const currentPageCapped =
    safeTotalPages !== null ? Math.min(Math.floor(safeCurrentPage), safeTotalPages) : Math.floor(safeCurrentPage)

  await booksStore.updateBookMetadata(book.value.id, {
    totalPages: safeTotalPages,
    currentPage: currentPageCapped,
    status: formStatus.value,
  })
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }

  showQueuedFeedbackIfAny()
  editMode.value = false
  notificationsStore.success(t('notifications.metadataSaved'))
}

async function onStartReadingSession() {
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

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
  if (bookId.value) booksStore.selectLibraryBook(bookId.value)
})
</script>

<template>
  <section class="bm-panel">
    <template v-if="book">
      <p class="bm-eyebrow">
        {{ t('books.detailTitle') }}
      </p>
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

          <div class="bm-subtle-panel mt-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="bm-stat-label">{{ t('books.progress') }}</p>
                <p class="bm-stat-value">
                  {{ book.currentPage }}
                  <span class="text-base font-semibold text-[var(--app-text-muted)]">
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
                :style="{ width: `${Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))}%` }"
              />
            </div>
            <p class="bm-muted mt-2 text-sm">
              {{ t('books.remainingPages') }}:
              {{ remainingPages === null ? t('books.unknownPages') : remainingPages }}
            </p>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
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
              <button
                v-if="!editMode"
                type="button"
                class="bm-button text-xs"
                @click="onStartEdit"
              >
                <Pencil
                  :size="14"
                  aria-hidden="true"
                />
                {{ t('books.editAction') }}
              </button>
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label class="bm-label">
                {{ t('books.pages') }}
                <input
                  v-model="formTotalPages"
                  type="number"
                  min="1"
                  :disabled="!editMode || isMetadataUpdating()"
                  class="bm-input mt-1 py-1.5 text-sm"
                >
              </label>

              <label class="bm-label">
                {{ t('books.progress') }}
                <input
                  v-model="formCurrentPage"
                  type="number"
                  min="0"
                  :disabled="!editMode || isMetadataUpdating()"
                  class="bm-input mt-1 py-1.5 text-sm"
                >
              </label>

              <label class="bm-label">
                {{ t('books.status') }}
                <select
                  v-model="formStatus"
                  :disabled="!editMode || isMetadataUpdating()"
                  class="bm-select mt-1 py-1.5 text-sm"
                >
                  <option value="reading">{{ t('books.status_reading') }}</option>
                  <option value="finished">{{ t('books.status_finished') }}</option>
                  <option value="wishlist">{{ t('books.status_wishlist') }}</option>
                </select>
              </label>
            </div>

            <div
              v-if="editMode"
              class="mt-3 flex gap-2"
            >
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
</template>
