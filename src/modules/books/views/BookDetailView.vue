<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { fetchRecentSessionsForBook } from '../../../services/readingSessionService'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import type { ReadingSessionRecord } from '../../../types/reading'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const authStore = useAuthStore()

const { favoriteUpdatingIds, metadataUpdatingIds, deletingIds } = storeToRefs(booksStore)
const { user } = storeToRefs(authStore)

const bookId = computed(() => String(route.params.id ?? ''))
const book = computed(() => booksStore.getLibraryBookById(bookId.value))
const editMode = ref(false)
const formTotalPages = ref<string>('')
const formCurrentPage = ref<string>('0')
const formStatus = ref<'reading' | 'finished' | 'wishlist'>('reading')
const recentSessions = ref<ReadingSessionRecord[]>([])
const loadingSessions = ref(false)

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

async function onToggleFavorite() {
  if (!book.value) return
  await booksStore.toggleFavorite(book.value.id)
}

async function onRemoveBook() {
  if (!book.value) return
  const accepted = window.confirm(t('books.removeConfirm'))
  if (!accepted) return

  await booksStore.removeFromLibrary(book.value.id)
  await router.push({ name: 'books' })
}

async function loadRecentSessions() {
  if (!book.value || !user.value?.uid) {
    recentSessions.value = []
    return
  }

  loadingSessions.value = true
  try {
    recentSessions.value = await fetchRecentSessionsForBook(user.value.uid, book.value.id)
  } catch {
    recentSessions.value = []
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

  editMode.value = false
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

watch(
  () => book.value?.id,
  async () => {
    syncFormFromBook()
    editMode.value = false
    await loadRecentSessions()
  },
)

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
  if (bookId.value) booksStore.selectLibraryBook(bookId.value)
  await loadRecentSessions()
})
</script>

<template>
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <template v-if="book">
      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('books.detailTitle') }}</p>
      <div class="mt-3 grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr]">
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="book.title"
          class="h-64 w-44 rounded-lg border border-slate-700 object-cover shadow-[0_12px_34px_rgba(0,0,0,0.45)]"
        />
        <div
          v-else
          class="flex h-64 w-44 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-400"
        >
          {{ t('books.noCover') }}
        </div>

        <div class="space-y-2">
          <h1 class="font-serif text-3xl font-semibold tracking-wide text-white">{{ book.title }}</h1>
          <p class="text-sm text-slate-300">{{ t('books.by') }} {{ book.authors.join(', ') || t('books.unknownAuthor') }}</p>
          <p class="text-sm text-slate-400">{{ t('books.source') }}: {{ book.source }}</p>
          <p class="text-sm text-slate-400">{{ t('books.pages') }}: {{ book.totalPages ?? t('books.unknownPages') }}</p>
          <p class="text-sm text-slate-400">
            {{ t('books.progress') }}: {{ book.currentPage }}
            <template v-if="book.totalPages">/ {{ book.totalPages }}</template>
          </p>
          <p class="text-sm text-slate-400">
            {{ t('books.remainingPages') }}:
            {{ remainingPages === null ? t('books.unknownPages') : remainingPages }}
          </p>
          <p class="text-sm text-slate-400">{{ t('books.status') }}: {{ t(`books.status_${book.status}`) }}</p>
          <p class="text-sm" :class="book.favorite ? 'text-amber-300' : 'text-slate-400'">
            {{ book.favorite ? t('books.favorite') : t('books.notFavorite') }}
          </p>

          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-cyan-500/60 px-3 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/10"
              @click="onStartReadingSession"
            >
              {{ t('books.startSession') }}
            </button>

            <button
              type="button"
              class="cursor-pointer rounded-xl border border-amber-500/60 px-3 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isFavoriteUpdating() || isDeleting()"
              @click="onToggleFavorite"
            >
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
              class="cursor-pointer rounded-xl border border-rose-500/60 px-3 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="isDeleting() || isFavoriteUpdating()"
              @click="onRemoveBook"
              >
                {{ isDeleting() ? t('books.deletingBook') : t('books.removeBook') }}
              </button>
          </div>

          <div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs uppercase tracking-wide text-slate-400">{{ t('books.editMetadata') }}</p>
              <button
                v-if="!editMode"
                type="button"
                class="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-800"
                @click="onStartEdit"
              >
                {{ t('books.editAction') }}
              </button>
            </div>

            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label class="text-xs text-slate-300">
                {{ t('books.pages') }}
                <input
                  v-model="formTotalPages"
                  type="number"
                  min="1"
                  :disabled="!editMode || isMetadataUpdating()"
                  class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2 disabled:opacity-60"
                />
              </label>

              <label class="text-xs text-slate-300">
                {{ t('books.progress') }}
                <input
                  v-model="formCurrentPage"
                  type="number"
                  min="0"
                  :disabled="!editMode || isMetadataUpdating()"
                  class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2 disabled:opacity-60"
                />
              </label>

              <label class="text-xs text-slate-300">
                {{ t('books.status') }}
                <select
                  v-model="formStatus"
                  :disabled="!editMode || isMetadataUpdating()"
                  class="mt-1 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="reading">{{ t('books.status_reading') }}</option>
                  <option value="finished">{{ t('books.status_finished') }}</option>
                  <option value="wishlist">{{ t('books.status_wishlist') }}</option>
                </select>
              </label>
            </div>

            <div v-if="editMode" class="mt-3 flex gap-2">
              <button
                type="button"
                class="cursor-pointer rounded-lg bg-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isMetadataUpdating()"
                @click="onSaveMetadata"
              >
                {{ isMetadataUpdating() ? t('books.savingMetadata') : t('books.saveMetadata') }}
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isMetadataUpdating()"
                @click="onCancelEdit"
              >
                {{ t('books.cancelEdit') }}
              </button>
            </div>
          </div>

          <div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p class="text-xs uppercase tracking-wide text-slate-400">{{ t('books.recentSessions') }}</p>
            <p v-if="loadingSessions" class="mt-2 text-sm text-slate-400">{{ t('books.loadingSessions') }}</p>

            <ul v-else-if="recentSessions.length > 0" class="mt-2 space-y-2">
              <li
                v-for="session in recentSessions"
                :key="session.id"
                class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300"
              >
                <p>{{ formatSessionDate(session.startedAt) }}</p>
                <p>
                  {{ t('books.sessionPages') }}:
                  {{ session.pagesRead ?? 0 }}
                </p>
                <p>
                  {{ t('books.sessionDuration') }}:
                  {{ Math.floor((session.durationSeconds ?? 0) / 60) }}m
                </p>
              </li>
            </ul>

            <p v-else class="mt-2 text-sm text-slate-400">{{ t('books.noSessions') }}</p>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <p class="text-sm text-slate-300">{{ t('books.notFound') }}</p>
      <RouterLink
        class="mt-4 inline-flex rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
        to="/books"
      >
        {{ t('books.backToLibrary') }}
      </RouterLink>
    </template>
  </section>
</template>
