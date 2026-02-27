<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookSearchResult } from '../../../types/books'
import type { AppLocale } from '../../../types/i18n'
import PromptModal from '../../../components/PromptModal.vue'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'

const { t, locale } = useI18n()
const booksStore = useBooksStore()
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const queryInput = ref('')
const showAddModal = ref(false)
const pendingBookToAdd = ref<BookSearchResult | null>(null)
const showAddBookPagesModal = ref(false)
const pendingManualPages = ref<string>('')

const {
  searchResults,
  searching,
  savingIds,
  errorKey,
  filteredSortedLibrary,
  favoriteUpdatingIds,
  showOnlyFavorites,
  librarySortMode,
} = storeToRefs(booksStore)
const { isAuthenticated } = storeToRefs(authStore)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))

async function onSearchSubmit() {
  await booksStore.search(queryInput.value, locale.value as AppLocale)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  if (queryInput.value.trim() && searchResults.value.length === 0) {
    notificationsStore.info(t('books.noResults'))
  }
}

function onClearSearch() {
  queryInput.value = ''
  booksStore.clearSearch()
}

function openAddModal() {
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

function isSaving(bookId: string): boolean {
  return savingIds.value.includes(bookId)
}

function isFavoriteUpdating(bookId: string): boolean {
  return favoriteUpdatingIds.value.includes(bookId)
}

async function onAddBook(bookId: string) {
  const target = searchResults.value.find((item) => item.id === bookId)
  if (!target) return
  pendingBookToAdd.value = target
  pendingManualPages.value = target.totalPages ? String(target.totalPages) : ''
  showAddBookPagesModal.value = true
}

function onCancelAddBookWithPages() {
  showAddBookPagesModal.value = false
  pendingBookToAdd.value = null
  pendingManualPages.value = ''
}

async function onConfirmAddBookWithPages() {
  if (!pendingBookToAdd.value) return

  const parsed = Number(pendingManualPages.value)
  const safePages = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
  const payload: BookSearchResult = {
    ...pendingBookToAdd.value,
    totalPages: safePages,
  }

  await booksStore.addSearchResultToLibrary(payload)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  if (booksStore.isBookInLibrary(payload)) {
    notificationsStore.success(t('notifications.bookAdded'))
  }
  onCancelAddBookWithPages()
}

async function onToggleFavorite(bookId: string) {
  const target = booksStore.getLibraryBookById(bookId)
  if (!target) return
  const nextFavorite = !target.favorite
  await booksStore.toggleFavorite(bookId)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  notificationsStore.success(
    nextFavorite ? t('notifications.bookMarkedFavorite') : t('notifications.bookUnmarkedFavorite'),
  )
}

onMounted(async () => {
  await booksStore.loadLibrary()
})
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('modules.booksLabel') }}</p>

      <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-white">{{ t('books.libraryTitle') }}</h1>
          <p class="mt-2 text-sm text-slate-300">{{ t('books.librarySubtitle') }}</p>
        </div>

        <button
          type="button"
          class="cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          @click="openAddModal"
        >
          + {{ t('books.openAddModal') }}
        </button>
      </div>

      <p v-if="mappedError" class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200">
        {{ mappedError }}
      </p>

      <div class="mt-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            v-model="showOnlyFavorites"
            type="checkbox"
            class="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
          />
          {{ t('books.onlyFavorites') }}
        </label>

        <label class="flex items-center gap-2 text-sm text-slate-300">
          <span>{{ t('books.sortBy') }}</span>
          <select
            v-model="librarySortMode"
            class="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400"
          >
            <option value="favorite_first">{{ t('books.sortFavoriteFirst') }}</option>
            <option value="recent">{{ t('books.sortRecent') }}</option>
            <option value="title_asc">{{ t('books.sortTitleAsc') }}</option>
          </select>
        </label>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <article
          v-for="item in filteredSortedLibrary"
          :key="item.id"
          class="group overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 transition hover:border-cyan-400"
        >
          <RouterLink class="block" :to="{ name: 'book-detail', params: { id: item.id } }">
            <div class="relative aspect-[2/3] w-full bg-slate-900">
              <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" class="h-full w-full object-cover" />
              <div
                v-else
                class="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-slate-400"
              >
                {{ t('books.noCover') }}
              </div>

              <button
                type="button"
                class="absolute right-2 top-2 cursor-pointer rounded-full border bg-slate-950/80 p-1.5 transition disabled:cursor-not-allowed disabled:opacity-60"
                :class="
                  item.favorite
                    ? 'border-rose-500/80 text-rose-400 hover:bg-rose-500/20'
                    : 'border-slate-600 text-slate-200 hover:border-rose-400 hover:text-rose-300'
                "
                :disabled="isFavoriteUpdating(item.id)"
                @click.prevent.stop="onToggleFavorite(item.id)"
              >
                <span class="text-sm leading-none">{{ item.favorite ? '♥' : '♡' }}</span>
              </button>
            </div>

            <div class="space-y-1 p-3">
              <p class="line-clamp-2 min-h-[2.5rem] font-serif text-sm font-semibold tracking-wide text-slate-100">
                {{ item.title }}
              </p>
              <p class="line-clamp-1 text-[11px] text-slate-400">
                {{ t('books.by') }} {{ item.authors.join(', ') || t('books.unknownAuthor') }}
              </p>
            </div>
          </RouterLink>
        </article>
      </div>

      <p v-if="filteredSortedLibrary.length === 0" class="mt-3 text-sm text-slate-400">
        {{ t('books.emptyLibrary') }}
      </p>
    </section>

    <div
      v-if="showAddModal"
      class="fixed inset-0 z-40 flex items-end bg-slate-950/80 p-3 sm:items-center sm:justify-center"
      @click.self="closeAddModal"
    >
      <section class="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-white">{{ t('books.title') }}</h2>
            <p class="mt-1 text-sm text-slate-300">{{ t('books.subtitle') }}</p>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-200 transition hover:bg-slate-800"
            @click="closeAddModal"
          >
            ✕
          </button>
        </div>

        <form class="mt-4 space-y-2" @submit.prevent="onSearchSubmit">
          <label class="block text-xs uppercase tracking-wide text-slate-400">{{ t('books.searchLabel') }}</label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              v-model="queryInput"
              type="text"
              :placeholder="t('books.searchPlaceholder')"
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2"
            />
            <button
              type="submit"
              class="cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="searching"
            >
              {{ searching ? t('books.searchLoading') : t('books.searchAction') }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!queryInput.trim() && searchResults.length === 0"
              @click="onClearSearch"
            >
              {{ t('books.clearSearch') }}
            </button>
          </div>
        </form>

        <div class="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1">
          <article
            v-for="book in searchResults"
            :key="book.id"
            class="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <div class="flex gap-3">
              <img
                v-if="book.coverUrl"
                :src="book.coverUrl"
                :alt="book.title"
                class="h-24 w-16 rounded-md border border-slate-700 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              />
              <div
                v-else
                class="flex h-24 w-16 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-[10px] text-slate-400"
              >
                {{ t('books.noCover') }}
              </div>

              <div class="min-w-0 flex-1">
                <p class="line-clamp-2 font-serif text-base font-semibold tracking-wide text-slate-100">
                  {{ book.title }}
                </p>
                <p class="text-xs text-slate-400">
                  {{ t('books.by') }} {{ book.authors.join(', ') || t('books.unknownAuthor') }}
                </p>
                <div class="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span class="rounded bg-slate-800 px-2 py-0.5">
                    {{ t('books.source') }}: {{ book.source }}
                  </span>
                  <span class="rounded bg-slate-800 px-2 py-0.5">
                    {{ t('books.pages') }}:
                    {{ book.totalPages ?? t('books.unknownPages') }}
                  </span>
                </div>
              </div>

              <button
                type="button"
                class="h-fit cursor-pointer rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!isAuthenticated || booksStore.isBookInLibrary(book) || isSaving(book.id)"
                @click="onAddBook(book.id)"
              >
                {{
                  booksStore.isBookInLibrary(book)
                    ? t('books.addedBook')
                    : isSaving(book.id)
                      ? t('books.addingBook')
                      : t('books.addBook')
                }}
              </button>
            </div>
          </article>

          <p v-if="!searching && queryInput.trim() && searchResults.length === 0" class="text-sm text-slate-400">
            {{ t('books.noResults') }}
          </p>
        </div>
      </section>
    </div>

    <PromptModal
      :open="showAddBookPagesModal"
      :title="t('books.addWithPagesTitle')"
      :message="t('books.addWithPagesMessage')"
      :confirm-label="t('books.addBook')"
      :cancel-label="t('common.cancel')"
      :value="pendingManualPages"
      :input-label="t('books.manualPages')"
      :input-placeholder="t('books.manualPagesPlaceholder')"
      input-type="number"
      input-min="1"
      @cancel="onCancelAddBookWithPages"
      @confirm="onConfirmAddBookWithPages"
      @update:value="pendingManualPages = $event"
    />
  </div>
</template>
