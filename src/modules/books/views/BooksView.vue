<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BookSearchResult } from '../../../types/books'
import type { AppLocale } from '../../../types/i18n'
import type { LibraryStatusFilter, SearchLanguageMode } from '../../../types/books-store'
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
const searchInputRef = ref<HTMLInputElement | null>(null)
const pendingBookToAdd = ref<BookSearchResult | null>(null)
const showAddBookPagesModal = ref(false)
const pendingManualPages = ref<string>('')
const manualTitle = ref('')
const manualAuthors = ref('')
const manualPages = ref('')
const manualCoverUrl = ref('')

const {
  query,
  searchResults,
  searching,
  loadingMoreSearch,
  hasMoreSearchResults,
  loadingLibrary,
  savingIds,
  errorKey,
  filteredSortedLibrary,
  favoriteUpdatingIds,
  showOnlyFavorites,
  libraryStatusFilter,
  librarySearchQuery,
  librarySortMode,
  searchLanguageMode,
} = storeToRefs(booksStore)
const { isAuthenticated } = storeToRefs(authStore)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))
const hasSearchExecuted = computed(() => query.value.trim().length > 0)
const skeletonKeys = [1, 2, 3, 4, 5]
const librarySkeletonKeys = [1, 2, 3, 4, 5, 6]

async function onSearchSubmit() {
  await booksStore.search(queryInput.value, locale.value as AppLocale)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
  }
}

async function onLoadMoreSearch() {
  await booksStore.loadMoreSearch(locale.value as AppLocale)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
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

function onChangeSearchLanguageMode(mode: SearchLanguageMode) {
  booksStore.setSearchLanguageMode(mode)
}

function onChangeLibraryStatusFilter(filter: LibraryStatusFilter) {
  libraryStatusFilter.value = filter
}

function isSaving(bookId: string): boolean {
  return savingIds.value.includes(bookId)
}

const isAddDisabled = (book: BookSearchResult): boolean =>
  !isAuthenticated.value || booksStore.isBookInLibrary(book) || isSaving(book.id)

const addButtonLabel = (book: BookSearchResult): string => {
  if (!isAuthenticated.value) {
    return t('books.authRequiredShort')
  }
  if (booksStore.isBookInLibrary(book)) {
    return t('books.addedBook')
  }
  if (isSaving(book.id)) {
    return t('books.addingBook')
  }
  return t('books.addBook')
}

const addDisabledReason = (book: BookSearchResult): string | null => {
  if (!isAuthenticated.value) {
    return t('books.authRequired')
  }
  if (booksStore.isBookInLibrary(book)) {
    return t('books.addedBookReason')
  }
  return null
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

function resetManualForm() {
  manualTitle.value = ''
  manualAuthors.value = ''
  manualPages.value = ''
  manualCoverUrl.value = ''
}

async function onAddManualBook() {
  const title = manualTitle.value.trim()
  if (!title) {
    notificationsStore.error(t('books.manualTitleRequired'))
    return
  }

  const authors = manualAuthors.value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
  const parsedPages = Number(manualPages.value)
  const totalPages = Number.isFinite(parsedPages) && parsedPages > 0 ? Math.floor(parsedPages) : null
  const coverUrl = manualCoverUrl.value.trim() || null

  const payload: BookSearchResult = {
    id: `manual:${Date.now()}`,
    source: 'manual',
    title,
    authors,
    coverUrl,
    totalPages,
    publishedYear: null,
  }

  await booksStore.addSearchResultToLibrary(payload)
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  notificationsStore.success(t('notifications.bookAdded'))
  resetManualForm()
}

onMounted(async () => {
  await booksStore.loadLibrary()
})

watch(showAddModal, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  searchInputRef.value?.focus()
})
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">
        {{ t('modules.booksLabel') }}
      </p>

      <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-white">
            {{ t('books.libraryTitle') }}
          </h1>
          <p class="mt-2 text-sm text-slate-300">
            {{ t('books.librarySubtitle') }}
          </p>
        </div>

        <button
          type="button"
          class="cursor-pointer rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          @click="openAddModal"
        >
          + {{ t('books.openAddModal') }}
        </button>
      </div>

      <p
        v-if="mappedError"
        class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200"
      >
        {{ mappedError }}
      </p>

      <div class="mt-4 flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              v-model="showOnlyFavorites"
              type="checkbox"
              class="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
            >
            {{ t('books.onlyFavorites') }}
          </label>

          <label class="flex items-center gap-2 text-sm text-slate-300">
            <span>{{ t('books.filterStatus') }}</span>
            <select
              :value="libraryStatusFilter"
              class="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400"
              @change="onChangeLibraryStatusFilter(($event.target as HTMLSelectElement).value as LibraryStatusFilter)"
            >
              <option value="all">{{ t('books.status_all') }}</option>
              <option value="reading">{{ t('books.status_reading') }}</option>
              <option value="finished">{{ t('books.status_finished') }}</option>
              <option value="wishlist">{{ t('books.status_wishlist') }}</option>
            </select>
          </label>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="librarySearchQuery"
            type="text"
            :placeholder="t('books.librarySearchPlaceholder')"
            class="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400 sm:w-56"
          >
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
      </div>

      <div
        v-if="loadingLibrary"
        class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <article
          v-for="item in librarySkeletonKeys"
          :key="item"
          class="animate-pulse overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70"
        >
          <div class="aspect-[2/3] w-full bg-slate-800" />
          <div class="space-y-2 p-3">
            <div class="h-4 w-5/6 rounded bg-slate-800" />
            <div class="h-3 w-2/3 rounded bg-slate-800" />
          </div>
        </article>
      </div>

      <div
        v-else
        class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        <article
          v-for="item in filteredSortedLibrary"
          :key="item.id"
          class="group overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 transition hover:border-cyan-400"
        >
          <RouterLink
            class="block"
            :to="{ name: 'book-detail', params: { id: item.id } }"
          >
            <div class="relative aspect-[2/3] w-full bg-slate-900">
              <img
                v-if="item.coverUrl"
                :src="item.coverUrl"
                :alt="item.title"
                class="h-full w-full object-cover"
              >
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

      <p
        v-if="!loadingLibrary && filteredSortedLibrary.length === 0"
        class="mt-3 text-sm text-slate-400"
      >
        {{ t('books.emptyLibrary') }}
      </p>
    </section>

    <div
      v-if="showAddModal"
      class="fixed inset-0 z-40 flex items-end bg-slate-950/80 p-3 sm:items-center sm:justify-center"
    >
      <section
        class="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6"
        @keydown.esc="closeAddModal"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold text-white">
              {{ t('books.title') }}
            </h2>
            <p class="mt-1 text-sm text-slate-300">
              {{ t('books.subtitle') }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{ t('books.modalCloseHint') }}
            </p>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-slate-700 px-2 py-1 text-sm text-slate-200 transition hover:bg-slate-800"
            @click="closeAddModal"
          >
            ✕
          </button>
        </div>

        <form
          class="mt-4 space-y-2"
          @submit.prevent="onSearchSubmit"
        >
          <label class="block text-xs uppercase tracking-wide text-slate-400">{{ t('books.searchLabel') }}</label>
          <div class="inline-flex rounded-lg border border-slate-800 bg-slate-950/60 p-1">
            <button
              type="button"
              class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
              :class="
                searchLanguageMode === 'active'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              "
              @click="onChangeSearchLanguageMode('active')"
            >
              {{ t('books.languageScopeActive') }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
              :class="
                searchLanguageMode === 'all'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              "
              @click="onChangeSearchLanguageMode('all')"
            >
              {{ t('books.languageScopeAll') }}
            </button>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              ref="searchInputRef"
              v-model="queryInput"
              type="text"
              :placeholder="t('books.searchPlaceholder')"
              class="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2"
            >
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

        <section class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-xs uppercase tracking-wide text-slate-400">
            {{ t('books.manualAddTitle') }}
          </p>
          <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label class="text-xs text-slate-300 sm:col-span-2">
              {{ t('books.manualBookTitle') }}
              <input
                v-model="manualTitle"
                type="text"
                :placeholder="t('books.manualBookTitlePlaceholder')"
                class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
              >
            </label>
            <label class="text-xs text-slate-300">
              {{ t('books.manualAuthors') }}
              <input
                v-model="manualAuthors"
                type="text"
                :placeholder="t('books.manualAuthorsPlaceholder')"
                class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
              >
            </label>
            <label class="text-xs text-slate-300">
              {{ t('books.manualPages') }}
              <input
                v-model="manualPages"
                type="number"
                min="1"
                :placeholder="t('books.manualPagesPlaceholder')"
                class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
              >
            </label>
            <label class="text-xs text-slate-300 sm:col-span-2">
              {{ t('books.manualCoverUrl') }}
              <input
                v-model="manualCoverUrl"
                type="url"
                :placeholder="t('books.manualCoverUrlPlaceholder')"
                class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
              >
            </label>
          </div>
          <button
            type="button"
            class="mt-3 cursor-pointer rounded-lg border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
            @click="onAddManualBook"
          >
            {{ t('books.manualAddAction') }}
          </button>
        </section>

        <div
          v-if="!hasSearchExecuted && !searching"
          class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
        >
          <p class="text-sm font-medium text-slate-200">
            {{ t('books.searchIdleTitle') }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            {{ t('books.searchIdleSubtitle') }}
          </p>
        </div>

        <div
          v-else-if="searching"
          class="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1"
        >
          <article
            v-for="item in skeletonKeys"
            :key="item"
            class="animate-pulse rounded-xl border border-slate-800 bg-slate-950/60 p-3"
          >
            <div class="flex gap-3">
              <div class="h-24 w-16 rounded-md bg-slate-800" />
              <div class="flex-1 space-y-2">
                <div class="h-4 w-2/3 rounded bg-slate-800" />
                <div class="h-3 w-1/2 rounded bg-slate-800" />
                <div class="h-3 w-1/3 rounded bg-slate-800" />
              </div>
              <div class="h-8 w-20 rounded bg-slate-800" />
            </div>
          </article>
        </div>

        <div
          v-else-if="searchResults.length === 0"
          class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
        >
          <p class="text-sm font-medium text-slate-200">
            {{ t('books.searchEmptyTitle') }}
          </p>
          <p class="mt-1 text-xs text-slate-400">
            {{ t('books.searchEmptySubtitle') }}
          </p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
              @click="onClearSearch"
            >
              {{ t('books.searchEmptyAction') }}
            </button>
            <button
              v-if="searchLanguageMode === 'active'"
              type="button"
              class="cursor-pointer rounded-lg border border-cyan-500/60 px-3 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-500/10"
              @click="onChangeSearchLanguageMode('all')"
            >
              {{ t('books.searchTryAllLanguages') }}
            </button>
          </div>
        </div>

        <div
          v-else
          class="mt-4 max-h-[48vh] space-y-3 overflow-y-auto pr-1"
        >
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
              >
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

              <div class="h-fit w-28 text-right">
                <button
                  type="button"
                  class="w-full cursor-pointer rounded-lg border border-emerald-500/50 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="isAddDisabled(book)"
                  @click="onAddBook(book.id)"
                >
                  {{ addButtonLabel(book) }}
                </button>
                <p
                  v-if="addDisabledReason(book)"
                  class="mt-1 text-[10px] leading-tight text-slate-400"
                >
                  {{ addDisabledReason(book) }}
                </p>
              </div>
            </div>
          </article>

          <button
            v-if="hasMoreSearchResults"
            type="button"
            class="w-full cursor-pointer rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loadingMoreSearch"
            @click="onLoadMoreSearch"
          >
            {{ loadingMoreSearch ? t('books.loadingMoreResults') : t('books.loadMoreResults') }}
          </button>
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
