<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Heart, Plus, Search, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { BookSearchResult } from '../../../types/books'
import type { AppLocale } from '../../../types/i18n'
import type { LibraryStatusFilter, SearchLanguageMode } from '../../../types/books-store'
import EmptyState from '../../../components/ui/EmptyState.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import PromptModal from '../../../components/PromptModal.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
import { withBodyScrollLock } from '../../../composables/useBodyScrollLock'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'

const { t, locale } = useI18n()
const router = useRouter()
const booksStore = useBooksStore()
const authStore = useAuthStore()
const notificationsStore = useNotificationsStore()
const queryInput = ref('')
const showAddModal = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const pendingBookToAdd = ref<BookSearchResult | null>(null)
const showAddBookPagesModal = ref(false)
const pendingManualPages = ref<string>('')
const pendingManualCoverUrl = ref<string>('')
const addAnotherBook = ref(false)
const addMode = ref<'search' | 'manual'>('search')
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
  syncQueuedMessageKey,
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
  addMode.value = 'search'
  showAddModal.value = true
}

function closeAddModal() {
  showAddModal.value = false
}

function onChangeAddMode(mode: 'search' | 'manual') {
  addMode.value = mode
}

function onChangeSearchLanguageMode(mode: SearchLanguageMode) {
  booksStore.setSearchLanguageMode(mode)
}

function onChangeLibraryStatusFilter(filter: LibraryStatusFilter) {
  libraryStatusFilter.value = filter
}

function showQueuedFeedbackIfAny() {
  if (!syncQueuedMessageKey.value) return
  notificationsStore.info(t(syncQueuedMessageKey.value))
  booksStore.clearSyncQueuedMessage()
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
  pendingManualCoverUrl.value = ''
  showAddBookPagesModal.value = true
}

function onCancelAddBookWithPages() {
  showAddBookPagesModal.value = false
  pendingBookToAdd.value = null
  pendingManualPages.value = ''
  pendingManualCoverUrl.value = ''
  addAnotherBook.value = false
}

function findAddedBook(book: BookSearchResult) {
  return (
    booksStore.getLibraryBookById(book.id) ??
    booksStore.getLibraryBookById(book.id.replace(':', '_')) ??
    (booksStore.selectedLibraryBookId ? booksStore.getLibraryBookById(booksStore.selectedLibraryBookId) : null)
  )
}

async function onConfirmAddBookWithPages() {
  if (!pendingBookToAdd.value) return

  const parsed = Number(pendingManualPages.value)
  const safePages = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
  const manualCoverUrl = pendingManualCoverUrl.value.trim()
  const payload: BookSearchResult = {
    ...pendingBookToAdd.value,
    coverUrl: pendingBookToAdd.value.coverUrl ?? (manualCoverUrl || null),
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
  showQueuedFeedbackIfAny()

  const shouldAddAnotherBook = addAnotherBook.value
  const addedBook = findAddedBook(payload)

  onCancelAddBookWithPages()

  if (shouldAddAnotherBook) {
    queryInput.value = ''
    booksStore.clearSearch()
    addMode.value = 'search'
  } else {
    closeAddModal()
    if (addedBook) {
      router.push({ name: 'book-detail', params: { id: addedBook.id } })
    }
  }
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
  showQueuedFeedbackIfAny()
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
  showQueuedFeedbackIfAny()
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

withBodyScrollLock(showAddModal)
</script>

<template>
  <div class="bm-page">
    <PageHeader
      :eyebrow="t('modules.booksLabel')"
      :title="t('books.libraryTitle')"
      :subtitle="t('books.librarySubtitle')"
    >
      <template #actions>
        <button
          type="button"
          class="bm-button bm-button-primary"
          @click="openAddModal"
        >
          <Plus
            :size="17"
            aria-hidden="true"
          />
          {{ t('books.openAddModal') }}
        </button>
      </template>
    </PageHeader>

    <SurfaceCard>
      <p
        v-if="mappedError"
        class="mb-3 rounded-lg border border-(--app-danger) bg-(--app-danger-soft) p-2 text-xs text-(--app-danger)"
      >
        {{ mappedError }}
      </p>

      <div class="bm-toolbar grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(8rem,0.85fr)_minmax(10rem,1fr)_minmax(14rem,1.4fr)_minmax(10rem,1fr)]">
        <label class="bm-label grid gap-1">
          <span>{{ t('books.favoritesFilter') }}</span>
          <span class="flex min-h-10 cursor-pointer items-center gap-2 rounded-[0.85rem] border border-(--app-border-strong) bg-(--app-surface-raised) px-3 text-sm text-(--app-text)">
            <input
              v-model="showOnlyFavorites"
              type="checkbox"
              class="h-4 w-4 cursor-pointer accent-(--app-primary)"
            >
            {{ t('books.onlyFavorites') }}
          </span>
        </label>

        <label class="bm-label grid gap-1">
          <span>{{ t('books.filterStatus') }}</span>
          <select
            :value="libraryStatusFilter"
            class="bm-select min-h-10 py-2 text-sm"
            @change="onChangeLibraryStatusFilter(($event.target as HTMLSelectElement).value as LibraryStatusFilter)"
          >
            <option value="all">{{ t('books.status_all') }}</option>
            <option value="reading">{{ t('books.status_reading') }}</option>
            <option value="finished">{{ t('books.status_finished') }}</option>
            <option value="wishlist">{{ t('books.status_wishlist') }}</option>
          </select>
        </label>

        <label class="bm-label grid gap-1">
          <span>{{ t('books.librarySearchLabel') }}</span>
          <span class="relative block">
            <Search
              :size="15"
              class="bm-library-search-icon pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-(--app-text-soft)"
              aria-hidden="true"
            />
            <input
              v-model="librarySearchQuery"
              type="text"
              :placeholder="t('books.librarySearchPlaceholder')"
              class="bm-input bm-library-search-input min-h-10 py-2 text-sm"
            >
          </span>
        </label>

        <label class="bm-label grid gap-1">
          <span>{{ t('books.sortBy') }}</span>
          <select
            v-model="librarySortMode"
            class="bm-select min-h-10 py-2 text-sm"
          >
            <option value="favorite_first">{{ t('books.sortFavoriteFirst') }}</option>
            <option value="recent">{{ t('books.sortRecent') }}</option>
            <option value="title_asc">{{ t('books.sortTitleAsc') }}</option>
          </select>
        </label>
      </div>

      <div
        v-if="loadingLibrary"
        class="bm-book-grid mt-4"
      >
        <article
          v-for="item in librarySkeletonKeys"
          :key="item"
          class="bm-book-card animate-pulse"
        >
          <div class="aspect-2/3 w-full bg-(--app-surface-muted)" />
          <div class="space-y-2 p-2 sm:p-3">
            <div class="h-4 w-5/6 rounded bg-(--app-border)" />
            <div class="h-3 w-2/3 rounded bg-(--app-border)" />
          </div>
        </article>
      </div>

      <div
        v-else
        class="bm-book-grid mt-4"
      >
        <article
          v-for="item in filteredSortedLibrary"
          :key="item.id"
          class="bm-book-card overflow-visible"
        >
          <div class="bm-book-cover relative">
            <RouterLink
              :to="{ name: 'book-detail', params: { id: item.id } }"
            >
              <img
                v-if="item.coverUrl"
                :src="item.coverUrl"
                :alt="item.title"
                class="h-full w-full object-cover"
              >
              <div
                v-else
                class="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-(--app-text-soft)"
              >
                {{ t('books.noCover') }}
              </div>
            </RouterLink>

            <button
              type="button"
              class="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border bg-(--app-surface) shadow transition disabled:cursor-not-allowed disabled:opacity-60"
              :class="
                item.favorite
                  ? 'border-(--app-danger) text-(--app-danger)'
                  : 'border-(--app-border) text-(--app-text-muted) hover:text-(--app-danger)'
              "
              :disabled="isFavoriteUpdating(item.id)"
              @click.prevent.stop="onToggleFavorite(item.id)"
            >
              <Heart
                :size="16"
                :fill="item.favorite ? 'currentColor' : 'none'"
                aria-hidden="true"
              />
            </button>
          </div>

          <div class="space-y-1 p-2 sm:p-3">
            <RouterLink
              class="block"
              :to="{ name: 'book-detail', params: { id: item.id } }"
            >
              <p class="line-clamp-2 min-h-9 font-serif text-[13px] font-semibold text-(--app-text) sm:text-sm">
                {{ item.title }}
              </p>
              <p class="bm-muted line-clamp-1 text-[10px] sm:text-[11px]">
                {{ t('books.by') }} {{ item.authors.join(', ') || t('books.unknownAuthor') }}
              </p>
            </RouterLink>
          </div>
        </article>
      </div>

      <EmptyState
        v-if="!loadingLibrary && filteredSortedLibrary.length === 0"
        class="mt-4"
        :title="t('books.emptyLibrary')"
        :description="t('books.librarySubtitle')"
      >
        <button
          type="button"
          class="bm-button bm-button-primary"
          @click="openAddModal"
        >
          <Plus
            :size="17"
            aria-hidden="true"
          />
          {{ t('books.openAddModal') }}
        </button>
      </EmptyState>
    </SurfaceCard>

    <div
      v-if="showAddModal"
      class="bm-modal-backdrop z-40"
    >
      <section
        class="bm-modal-sheet flex max-w-2xl flex-col p-4 sm:p-6"
        @keydown.esc="closeAddModal"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="bm-section-title">
              {{ t('books.title') }}
            </h2>
            <p class="bm-muted mt-1 text-sm">
              {{ t('books.subtitle') }}
            </p>
            <p class="bm-soft mt-1 text-xs">
              {{ t('books.modalCloseHint') }}
            </p>
          </div>
          <button
            type="button"
            class="bm-icon-button"
            :aria-label="t('common.cancel')"
            :title="t('common.cancel')"
            @click="closeAddModal"
          >
            <X
              :size="18"
              aria-hidden="true"
            />
          </button>
        </div>

        <div
          class="mt-4 inline-flex w-fit rounded-lg border border-(--app-border) bg-(--app-surface-muted) p-1"
          role="tablist"
          :aria-label="t('books.openAddModal')"
        >
          <button
            type="button"
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition"
            role="tab"
            :aria-selected="addMode === 'search'"
            :class="
              addMode === 'search'
                ? 'bg-(--app-primary) text-(--app-primary-contrast)'
                : 'text-(--app-text-muted) hover:bg-(--app-surface)'
            "
            @click="onChangeAddMode('search')"
          >
            {{ t('books.addModeSearch') }}
          </button>
          <button
            type="button"
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition"
            role="tab"
            :aria-selected="addMode === 'manual'"
            :class="
              addMode === 'manual'
                ? 'bg-(--app-primary) text-(--app-primary-contrast)'
                : 'text-(--app-text-muted) hover:bg-(--app-surface)'
            "
            @click="onChangeAddMode('manual')"
          >
            {{ t('books.addModeManual') }}
          </button>
        </div>

        <div class="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          <form
            v-if="addMode === 'search'"
            class="space-y-2"
            @submit.prevent="onSearchSubmit"
          >
            <label class="bm-label block">{{ t('books.searchLabel') }}</label>
            <div class="inline-flex rounded-lg border border-(--app-border) bg-(--app-surface-muted) p-1">
              <button
                type="button"
                class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
                :class="
                  searchLanguageMode === 'active'
                    ? 'bg-(--app-primary) text-(--app-primary-contrast)'
                    : 'text-(--app-text-muted) hover:bg-(--app-surface)'
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
                    ? 'bg-(--app-primary) text-(--app-primary-contrast)'
                    : 'text-(--app-text-muted) hover:bg-(--app-surface)'
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
                class="bm-input text-sm"
              >
              <button
                type="submit"
                class="bm-button bm-button-primary"
                :disabled="searching"
              >
                {{ searching ? t('books.searchLoading') : t('books.searchAction') }}
              </button>
              <button
                type="button"
                class="bm-button"
                :disabled="!queryInput.trim() && searchResults.length === 0"
                @click="onClearSearch"
              >
                {{ t('books.clearSearch') }}
              </button>
            </div>
          </form>

          <section
            v-if="addMode === 'manual'"
            class="bm-subtle-panel"
          >
            <p class="bm-eyebrow">
              {{ t('books.manualAddTitle') }}
            </p>
            <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label class="bm-label sm:col-span-2">
                {{ t('books.manualBookTitle') }}
                <input
                  v-model="manualTitle"
                  type="text"
                  :placeholder="t('books.manualBookTitlePlaceholder')"
                  class="bm-input mt-1 py-1.5 text-sm"
                >
              </label>
              <label class="bm-label">
                {{ t('books.manualAuthors') }}
                <input
                  v-model="manualAuthors"
                  type="text"
                  :placeholder="t('books.manualAuthorsPlaceholder')"
                  class="bm-input mt-1 py-1.5 text-sm"
                >
              </label>
              <label class="bm-label">
                {{ t('books.manualPages') }}
                <input
                  v-model="manualPages"
                  type="number"
                  min="1"
                  :placeholder="t('books.manualPagesPlaceholder')"
                  class="bm-input mt-1 py-1.5 text-sm"
                >
              </label>
              <label class="bm-label sm:col-span-2">
                {{ t('books.manualCoverUrl') }}
                <input
                  v-model="manualCoverUrl"
                  type="url"
                  :placeholder="t('books.manualCoverUrlPlaceholder')"
                  class="bm-input mt-1 py-1.5 text-sm"
                >
              </label>
            </div>
            <button
              type="button"
              class="bm-button bm-button-success mt-3 text-xs"
              @click="onAddManualBook"
            >
              {{ t('books.manualAddAction') }}
            </button>
          </section>

          <div
            v-if="addMode === 'search' && !hasSearchExecuted && !searching"
            class="bm-empty"
          >
            <p class="bm-section-title">
              {{ t('books.searchIdleTitle') }}
            </p>
            <p class="bm-muted mt-1 text-xs">
              {{ t('books.searchIdleSubtitle') }}
            </p>
          </div>

          <div
            v-else-if="addMode === 'search' && searching"
            class="space-y-3"
          >
            <article
              v-for="item in skeletonKeys"
              :key="item"
              class="bm-card animate-pulse"
            >
              <div class="flex gap-3">
                <div class="h-32 w-[5.35rem] rounded-md bg-(--app-surface-muted) sm:h-28 sm:w-[4.65rem]" />
                <div class="min-w-0 flex-1 space-y-2">
                  <div class="h-4 w-full rounded bg-(--app-border) sm:w-2/3" />
                  <div class="h-3 w-3/4 rounded bg-(--app-border) sm:w-1/2" />
                  <div class="h-3 w-1/2 rounded bg-(--app-border) sm:w-1/3" />
                  <div class="h-8 w-full rounded bg-(--app-border) sm:hidden" />
                </div>
                <div class="hidden h-8 w-20 rounded bg-(--app-border) sm:block" />
              </div>
            </article>
          </div>

          <div
            v-else-if="addMode === 'search' && searchResults.length === 0"
            class="bm-empty"
          >
            <p class="bm-section-title">
              {{ t('books.searchEmptyTitle') }}
            </p>
            <p class="bm-muted mt-1 text-xs">
              {{ t('books.searchEmptySubtitle') }}
            </p>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                class="bm-button text-xs"
                @click="onClearSearch"
              >
                {{ t('books.searchEmptyAction') }}
              </button>
              <button
                v-if="searchLanguageMode === 'active'"
                type="button"
                class="bm-button bm-button-primary text-xs"
                @click="onChangeSearchLanguageMode('all')"
              >
                {{ t('books.searchTryAllLanguages') }}
              </button>
            </div>
          </div>

          <div
            v-else-if="addMode === 'search'"
            class="space-y-3"
          >
            <article
              v-for="book in searchResults"
              :key="book.id"
              class="bm-card"
            >
              <div class="flex gap-3">
                <img
                  v-if="book.coverUrl"
                  :src="book.coverUrl"
                  :alt="book.title"
                  class="h-32 w-[5.35rem] rounded-md border border-(--app-border) object-cover shadow sm:h-28 sm:w-[4.65rem]"
                >
                <div
                  v-else
                  class="flex h-32 w-[5.35rem] items-center justify-center rounded-md border border-(--app-border) bg-(--app-surface-muted) text-center text-[10px] text-(--app-text-soft) sm:h-28 sm:w-[4.65rem]"
                >
                  {{ t('books.noCover') }}
                </div>

                <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start">
                  <div class="min-w-0 flex-1">
                    <p class="line-clamp-2 font-serif text-base font-semibold text-(--app-text)">
                      {{ book.title }}
                    </p>
                    <p class="bm-muted text-xs">
                      {{ t('books.by') }} {{ book.authors.join(', ') || t('books.unknownAuthor') }}
                    </p>
                    <div class="bm-muted mt-1 flex flex-wrap gap-2 text-[11px]">
                      <span class="rounded bg-(--app-surface-muted) px-2 py-0.5">
                        {{ t('books.source') }}: {{ book.source }}
                      </span>
                      <span class="rounded bg-(--app-surface-muted) px-2 py-0.5">
                        {{ t('books.pages') }}:
                        {{ book.totalPages ?? t('books.unknownPages') }}
                      </span>
                    </div>
                  </div>

                  <div class="h-fit w-full text-right sm:w-28">
                    <button
                      type="button"
                      class="bm-button bm-button-success w-full text-xs"
                      :disabled="isAddDisabled(book)"
                      @click="onAddBook(book.id)"
                    >
                      {{ addButtonLabel(book) }}
                    </button>
                    <p
                      v-if="addDisabledReason(book)"
                      class="bm-muted mt-1 text-left text-[10px] leading-tight sm:text-right"
                    >
                      {{ addDisabledReason(book) }}
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <button
              v-if="hasMoreSearchResults"
              type="button"
              class="bm-button w-full"
              :disabled="loadingMoreSearch"
              @click="onLoadMoreSearch"
            >
              {{ loadingMoreSearch ? t('books.loadingMoreResults') : t('books.loadMoreResults') }}
            </button>
          </div>
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
    >
      <template #details>
        <label
          v-if="pendingBookToAdd && !pendingBookToAdd.coverUrl"
          class="bm-label mt-3 block"
        >
          {{ t('books.manualCoverUrl') }}
          <input
            v-model="pendingManualCoverUrl"
            type="url"
            :placeholder="t('books.manualCoverUrlPlaceholder')"
            class="bm-input mt-1 text-sm"
          >
        </label>
        <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-(--app-text)">
          <input
            v-model="addAnotherBook"
            type="checkbox"
            class="h-4 w-4 rounded border-(--app-border) text-(--app-primary) accent-(--app-primary)"
          >
          {{ t('books.addAnotherBook') }}
        </label>
      </template>
    </PromptModal>
  </div>
</template>
