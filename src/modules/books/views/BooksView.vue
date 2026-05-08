<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, Heart, Plus, Search, Shuffle, X } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { BookSearchResult, LibraryBook } from '../../../types/books'
import type { AppLocale } from '../../../types/i18n'
import type { SearchLanguageMode } from '../../../types/books-store'
import EmptyState from '../../../components/ui/EmptyState.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import PromptModal from '../../../components/PromptModal.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
import StarRating from '../../../components/ui/StarRating.vue'
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
const showRandomPickerModal = ref(false)
const selectedRandomBook = ref<LibraryBook | null>(null)
const includePausedInRandom = ref(false)
const includePausedInPendingBooks = ref(false)
const isAnimating = ref(false)
const randomAnimationKey = ref(0)
const randomAnimationTimeoutId = ref<number | null>(null)
const randomConfirmButtonRef = ref<HTMLButtonElement | null>(null)

const {
  query,
  searchResults,
  library,
  searching,
  loadingMoreSearch,
  hasMoreSearchResults,
  loadingLibrary,
  savingIds,
  errorKey,
  filteredSortedLibrary,
  favoriteUpdatingIds,
  showOnlyFavorites,
  librarySearchQuery,
  librarySortMode,
  searchLanguageMode,
  syncQueuedMessageKey,
} = storeToRefs(booksStore)
const { isAuthenticated } = storeToRefs(authStore)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))
const hasSearchExecuted = computed(() => query.value.trim().length > 0)
const pendingLibrary = computed(() => {
  const normalizedQuery = librarySearchQuery.value.trim().toLowerCase()
  const base = library.value.filter((book) => {
    if (showOnlyFavorites.value && !book.favorite) return false
    if (!(book.status === 'wishlist' || (includePausedInPendingBooks.value && book.status === 'paused'))) return false
    if (!normalizedQuery) return true
    const titleMatch = book.title.toLowerCase().includes(normalizedQuery)
    const authorMatch = book.authors.some((author) => author.toLowerCase().includes(normalizedQuery))
    return titleMatch || authorMatch
  })
  if (librarySortMode.value === 'title_asc') {
    return [...base].sort((a, b) => a.title.localeCompare(b.title))
  }
  if (librarySortMode.value === 'recent') {
    return base
  }
  return [...base].sort((a, b) => Number(b.favorite) - Number(a.favorite))
})
const randomCandidates = computed(() =>
  filteredSortedLibrary.value.filter(
    (book) => book.status === 'wishlist' || (includePausedInRandom.value && book.status === 'paused'),
  ),
)
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

function selectRandomBook(previousBookId?: string | null): LibraryBook | null {
  const candidates = randomCandidates.value
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  let nextBook = candidates[Math.floor(Math.random() * candidates.length)]
  if (previousBookId && nextBook.id === previousBookId) {
    const alternatives = candidates.filter((candidate) => candidate.id !== previousBookId)
    nextBook = alternatives[Math.floor(Math.random() * alternatives.length)] ?? nextBook
  }
  return nextBook
}

function clearRandomAnimationTimeout() {
  if (randomAnimationTimeoutId.value === null) return
  window.clearTimeout(randomAnimationTimeoutId.value)
  randomAnimationTimeoutId.value = null
}

function triggerRandomSelectionAnimation() {
  clearRandomAnimationTimeout()
  isAnimating.value = true
  randomAnimationKey.value += 1
  randomAnimationTimeoutId.value = window.setTimeout(() => {
    isAnimating.value = false
    randomAnimationTimeoutId.value = null
  }, 420)
}

function openRandomPickerModal() {
  includePausedInRandom.value = false
  selectedRandomBook.value = selectRandomBook()
  isAnimating.value = false
  randomAnimationKey.value = 0
  showRandomPickerModal.value = true
  if (selectedRandomBook.value) {
    triggerRandomSelectionAnimation()
  }
}

function closeRandomPickerModal() {
  clearRandomAnimationTimeout()
  isAnimating.value = false
  showRandomPickerModal.value = false
}

function onPickAnotherRandomBook() {
  const previousBookId = selectedRandomBook.value?.id ?? null
  selectedRandomBook.value = selectRandomBook(previousBookId)
  if (selectedRandomBook.value) {
    triggerRandomSelectionAnimation()
  }
}

function onToggleIncludePausedInRandom() {
  const previousBookId = selectedRandomBook.value?.id ?? null
  selectedRandomBook.value = selectRandomBook(previousBookId)
  if (selectedRandomBook.value) {
    triggerRandomSelectionAnimation()
  } else {
    clearRandomAnimationTimeout()
    isAnimating.value = false
  }
}

function onConfirmRandomBook() {
  if (!selectedRandomBook.value) return
  closeRandomPickerModal()
  void Promise.resolve(router.push({ name: 'book-detail', params: { id: selectedRandomBook.value.id } })).catch(() => {})
}

function onOpenAddFromRandomEmpty() {
  closeRandomPickerModal()
  openAddModal()
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
      await router.push({name: 'book-detail', params: {id: addedBook.id}})
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
  const query = (router as { currentRoute?: { value?: { query?: Record<string, unknown> } } }).currentRoute?.value
    ?.query
  if (query?.pending === '1') {
    includePausedInPendingBooks.value = query.includePaused === '1'
  }
})

watch(showAddModal, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  searchInputRef.value?.focus()
})

watch(showRandomPickerModal, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  randomConfirmButtonRef.value?.focus()
})

withBodyScrollLock(showAddModal)
withBodyScrollLock(showRandomPickerModal)

onBeforeUnmount(() => {
  clearRandomAnimationTimeout()
})
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
        <button
          type="button"
          class="bm-button"
          @click="openRandomPickerModal"
        >
          <Shuffle
            :size="17"
            aria-hidden="true"
          />
          {{ t('books.pickRandomAction') }}
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

      <div class="bm-toolbar grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(8rem,0.95fr)_minmax(14rem,1.4fr)_minmax(10rem,1fr)]">
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
          <span>{{ t('books.pendingBooksSection') }}</span>
          <span class="flex min-h-10 cursor-pointer items-center gap-2 rounded-[0.85rem] border border-(--app-border-strong) bg-(--app-surface-raised) px-3 text-sm text-(--app-text)">
            <input
              v-model="includePausedInPendingBooks"
              type="checkbox"
              class="h-4 w-4 cursor-pointer accent-(--app-primary)"
            >
            {{ t('books.showPausedBooks') }}
          </span>
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

      <TransitionGroup
        v-else
        name="bm-stagger"
        tag="div"
        class="bm-book-grid mt-4"
      >
        <article
          v-for="(item, index) in pendingLibrary"
          :key="item.id"
          class="bm-book-card overflow-visible"
          :style="{ transitionDelay: `${Math.min(index, 10) * 24}ms` }"
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

            <span
              v-if="item.status === 'finished'"
              class="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-white/80 bg-(--app-success) px-2 py-1 text-[10px] font-bold leading-none text-white shadow-lg"
            >
              <Check
                :size="12"
                aria-hidden="true"
              />
              {{ t('books.readBadge') }}
            </span>

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
              <div
                v-if="item.rating"
                class="mt-1"
              >
                <StarRating
                  :model-value="item.rating"
                  readonly
                  :size="14"
                />
              </div>
            </RouterLink>
          </div>
        </article>
      </TransitionGroup>

      <EmptyState
        v-if="!loadingLibrary && pendingLibrary.length === 0"
        class="mt-4"
        :title="t('books.randomModalEmptyTitle')"
        :description="t('books.pendingBooksSubtitle')"
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

    <Transition name="bm-modal">
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
    </Transition>

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

    <Transition name="bm-modal">
      <div
        v-if="showRandomPickerModal"
        class="bm-modal-backdrop z-50"
        @click.self="closeRandomPickerModal"
      >
        <section
          class="bm-modal-sheet bm-random-modal flex max-w-md flex-col p-4 sm:p-6"
          role="dialog"
          :aria-label="t('books.randomModalTitle')"
          @keydown.esc="closeRandomPickerModal"
        >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="bm-eyebrow">{{ t('books.randomModalEyebrow') }}</p>
            <h2 class="bm-section-title mt-1">
              {{ t('books.randomModalTitle') }}
            </h2>
            <p class="bm-muted mt-1 text-sm">
              {{
                includePausedInRandom
                  ? t('books.randomModalSubtitleWithPaused')
                  : t('books.randomModalSubtitle')
              }}
            </p>
          </div>
          <button
            type="button"
            class="bm-icon-button"
            :aria-label="t('common.cancel')"
            :title="t('common.cancel')"
            @click="closeRandomPickerModal"
          >
            <X
              :size="18"
              aria-hidden="true"
            />
          </button>
        </div>

        <div class="mt-4 flex-1 overflow-y-auto pr-1">
          <label class="mb-3 flex cursor-pointer items-center gap-2 text-sm text-(--app-text)">
            <input
              v-model="includePausedInRandom"
              type="checkbox"
              class="h-4 w-4 rounded border-(--app-border) text-(--app-primary) accent-(--app-primary)"
              @change="onToggleIncludePausedInRandom"
            >
            {{ t('books.includePausedInRandom') }}
          </label>

          <div
            v-if="!selectedRandomBook"
            class="bm-subtle-panel text-center"
          >
            <p class="bm-section-title">{{ t('books.randomModalEmptyTitle') }}</p>
            <p class="bm-muted mt-1 text-xs">
              {{
                includePausedInRandom
                  ? t('books.randomModalEmptySubtitleWithPaused')
                  : t('books.randomModalEmptySubtitle')
              }}
            </p>
            <button
              type="button"
              class="bm-button bm-button-primary mt-3 text-xs"
              @click="onOpenAddFromRandomEmpty"
            >
              {{ t('books.openAddModal') }}
            </button>
          </div>

          <Transition
            v-else
            name="bm-random-book"
            mode="out-in"
          >
            <article
              :key="`${selectedRandomBook.id}-${randomAnimationKey}`"
              class="bm-subtle-panel bm-random-selection"
              :class="{ 'bm-random-selection--animating': isAnimating }"
            >
              <div class="flex gap-3">
                <div class="h-28 w-20 flex-none overflow-hidden rounded-lg border border-(--app-border) bg-(--app-surface-raised)">
                  <img
                    v-if="selectedRandomBook.coverUrl"
                    :src="selectedRandomBook.coverUrl"
                    :alt="selectedRandomBook.title"
                    class="h-full w-full object-cover"
                  >
                  <div
                    v-else
                    class="grid h-full w-full place-items-center px-2 text-center text-[10px] text-(--app-text-soft)"
                  >
                    {{ t('books.noCover') }}
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="line-clamp-3 text-sm font-bold text-(--app-text)">
                    {{ selectedRandomBook.title }}
                  </p>
                  <p class="bm-muted mt-1 text-xs">
                    {{ t('books.by') }} {{ selectedRandomBook.authors.join(', ') || t('books.unknownAuthor') }}
                  </p>
                  <p class="bm-soft mt-2 text-[11px]">
                    {{
                      includePausedInRandom
                        ? t('books.randomModalHintWithPaused')
                        : t('books.randomModalHint')
                    }}
                  </p>
                </div>
              </div>
            </article>
          </Transition>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            class="bm-button"
            :disabled="!selectedRandomBook"
            @click="onPickAnotherRandomBook"
          >
            {{ t('books.randomPickAnother') }}
          </button>
          <button
            ref="randomConfirmButtonRef"
            type="button"
            class="bm-button bm-button-success"
            :disabled="!selectedRandomBook"
            @click="onConfirmRandomBook"
          >
            {{ t('books.randomPickThis') }}
          </button>
        </div>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.bm-random-book-enter-active,
.bm-random-book-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.bm-random-book-enter-from,
.bm-random-book-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}

.bm-random-selection--animating {
  animation: bm-random-pulse 0.42s ease;
}

@keyframes bm-random-pulse {
  0% {
    transform: rotateX(0deg) scale(1);
  }
  40% {
    transform: rotateX(6deg) scale(1.02);
  }
  100% {
    transform: rotateX(0deg) scale(1);
  }
}
</style>
