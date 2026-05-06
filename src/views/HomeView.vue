<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowRight, BookOpen, Flame, Heart, Library, TimerReset, Trophy } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import EmptyState from '../components/ui/EmptyState.vue'
import PageHeader from '../components/ui/PageHeader.vue'
import StatusBadge from '../components/ui/StatusBadge.vue'
import SurfaceCard from '../components/ui/SurfaceCard.vue'
import { useAuthStore } from '../stores/auth'
import { useBooksStore } from '../stores/books'
import { useSessionsStore } from '../stores/sessions'
import { useStreakStore } from '../stores/streak'

const authStore = useAuthStore()
const booksStore = useBooksStore()
const sessionsStore = useSessionsStore()
const streakStore = useStreakStore()
const { t } = useI18n()

const { user } = storeToRefs(authStore)
const { library, loadingLibrary, favoriteUpdatingIds } = storeToRefs(booksStore)
const { latestSessionMillisByBook } = storeToRefs(sessionsStore)
const { currentStreakDays, bestStreakDays } = storeToRefs(streakStore)
const isMobileDashboard = ref(false)
const totalBooks = computed(() => library.value.length)
const favoriteBooks = computed(() => library.value.filter((book) => book.favorite).length)
const readingBooks = computed(() => library.value.filter((book) => book.status === 'reading').length)
const sortedPreviewBooks = computed(() =>
  [...library.value].sort((a, b) => {
    const favoriteDiff = Number(b.favorite) - Number(a.favorite)
    if (favoriteDiff !== 0) return favoriteDiff
    return a.title.localeCompare(b.title)
  }),
)
const mobilePreviewLimit = computed(() => {
  const count = sortedPreviewBooks.value.length
  if (count >= 6) return 6
  if (count >= 4) return 4
  if (count >= 2) return 2
  return count
})
const previewBooks = computed(() =>
  sortedPreviewBooks.value.slice(0, isMobileDashboard.value ? mobilePreviewLimit.value : 5),
)
const continueReadingBook = computed(() => {
  const reading = library.value.filter((book) => book.status === 'reading')
  if (reading.length === 0) return null
  return [...reading].sort((a, b) => {
    const dateA = latestSessionMillisByBook.value[a.id] ?? 0
    const dateB = latestSessionMillisByBook.value[b.id] ?? 0
    if (dateB !== dateA) return dateB - dateA
    return b.currentPage - a.currentPage
  })[0] ?? null
})
const lastActivityLabel = computed(() => {
  const book = continueReadingBook.value
  if (!book) return null
  const millis = latestSessionMillisByBook.value[book.id]
  if (!millis) return t('home.noRecentSession')
  return new Date(millis).toLocaleDateString()
})

function isFavoriteUpdating(bookId: string): boolean {
  return favoriteUpdatingIds.value.includes(bookId)
}

async function onToggleFavorite(bookId: string) {
  await booksStore.toggleFavorite(bookId)
}

function updateDashboardViewport() {
  isMobileDashboard.value = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
}

onMounted(async () => {
  updateDashboardViewport()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateDashboardViewport)
  }
  await booksStore.ensureLibraryLoaded()
  if (!user.value?.uid) return
  await sessionsStore.ensureSessionsLoaded()
  await streakStore.migrateFromSessions(sessionsStore.allSessions)
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateDashboardViewport)
  }
})
</script>

<template>
  <div class="bm-page">
    <PageHeader
      :eyebrow="t('common.bookMemory')"
      :title="t('home.libraryHubTitle')"
      :subtitle="t('home.libraryHubSubtitle')"
    >
      <template #actions>
        <StatusBadge>{{ user?.email ?? t('home.fallbackUser') }}</StatusBadge>
      </template>
    </PageHeader>

    <div class="bm-home-stats grid grid-cols-3 gap-2 sm:hidden">
      <article class="bm-stat-card bm-home-stat-card">
        <Library
          :size="19"
          class="bm-home-stat-icon text-(--app-primary-strong)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('home.kpiBooks') }}</p>
        <p class="bm-stat-value bm-home-stat-value">{{ totalBooks }}</p>
      </article>
      <article class="bm-stat-card bm-home-stat-card">
        <Heart
          :size="19"
          class="bm-home-stat-icon text-(--app-warm)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('home.kpiFavorites') }}</p>
        <p class="bm-stat-value bm-home-stat-value text-(--app-warm)">{{ favoriteBooks }}</p>
      </article>
      <article class="bm-stat-card bm-home-stat-card">
        <BookOpen
          :size="19"
          class="bm-home-stat-icon text-(--app-primary-strong)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('home.kpiReading') }}</p>
        <p class="bm-stat-value bm-home-stat-value">{{ readingBooks }}</p>
      </article>
    </div>

    <article class="bm-stat-card flex items-center justify-around gap-2 px-3 py-2.5 sm:hidden">
      <div class="flex min-w-0 items-center gap-2">
        <Flame
          :size="18"
          class="flex-none text-(--app-warning)"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <p class="bm-stat-label text-[10px] leading-tight">{{ t('streak.current') }}</p>
          <p class="text-xl font-black leading-none text-(--app-warning)">{{ currentStreakDays }}</p>
        </div>
      </div>
      <div class="h-9 w-px bg-(--app-border)" />
      <div class="flex min-w-0 items-center gap-2">
        <Trophy
          :size="18"
          class="flex-none text-(--app-accent-strong)"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <p class="bm-stat-label text-[10px] leading-tight">{{ t('streak.best') }}</p>
          <p class="text-xl font-black leading-none text-(--app-text)">{{ bestStreakDays }}</p>
        </div>
      </div>
    </article>

    <div class="bm-home-stats hidden gap-2 sm:grid sm:grid-cols-5 sm:gap-3">
      <article class="bm-stat-card bm-home-stat-card">
        <Library
          :size="19"
          class="bm-home-stat-icon text-(--app-primary-strong)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('home.kpiBooks') }}</p>
        <p class="bm-stat-value bm-home-stat-value">{{ totalBooks }}</p>
      </article>
      <article class="bm-stat-card bm-home-stat-card">
        <Heart
          :size="19"
          class="bm-home-stat-icon text-(--app-warm)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('home.kpiFavorites') }}</p>
        <p class="bm-stat-value bm-home-stat-value text-(--app-warm)">{{ favoriteBooks }}</p>
      </article>
      <article class="bm-stat-card bm-home-stat-card">
        <BookOpen
          :size="19"
          class="bm-home-stat-icon text-(--app-primary-strong)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('home.kpiReading') }}</p>
        <p class="bm-stat-value bm-home-stat-value">{{ readingBooks }}</p>
      </article>
      <article class="bm-stat-card bm-home-stat-card">
        <Flame
          :size="19"
          class="bm-home-stat-icon text-(--app-warning)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('streak.current') }}</p>
        <p class="bm-stat-value bm-home-stat-value text-(--app-warning)">{{ currentStreakDays }}</p>
      </article>
      <article class="bm-stat-card bm-home-stat-card">
        <Trophy
          :size="19"
          class="bm-home-stat-icon text-(--app-accent-strong)"
          aria-hidden="true"
        />
        <p class="bm-stat-label bm-home-stat-label">{{ t('streak.best') }}</p>
        <p class="bm-stat-value bm-home-stat-value">{{ bestStreakDays }}</p>
      </article>
    </div>

    <SurfaceCard>
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 class="bm-section-title">{{ t('home.continueReadingTitle') }}</h2>
          <p class="bm-muted text-xs">{{ t('home.continueReadingSubtitle') }}</p>
        </div>
      </div>
      <div
        v-if="continueReadingBook"
        class="grid gap-4 rounded-2xl border border-(--app-border) bg-(--app-surface-muted) p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div>
          <StatusBadge tone="success">
            <TimerReset
              :size="14"
              aria-hidden="true"
            />
            {{ t('home.continueReadingTitle') }}
          </StatusBadge>
          <p class="mt-3 font-serif text-2xl font-bold text-(--app-text)">
            {{ continueReadingBook.title }}
          </p>
          <p class="bm-muted mt-1 text-sm">
            {{ t('books.by') }} {{ continueReadingBook.authors.join(', ') || t('books.unknownAuthor') }}
          </p>
          <p class="bm-muted mt-2 text-sm">
            {{ t('books.progress') }}: {{ continueReadingBook.currentPage }}
            <template v-if="continueReadingBook.totalPages"> / {{ continueReadingBook.totalPages }}</template>
          </p>
          <p class="bm-soft mt-1 text-xs">
            {{ t('home.lastActivity') }}: {{ lastActivityLabel }}
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-2 sm:flex-col sm:justify-end">
          <RouterLink
            class="bm-button bm-button-primary"
            :to="{ name: 'reading', query: { bookId: continueReadingBook.id } }"
          >
            <TimerReset
              :size="16"
              aria-hidden="true"
            />
            {{ t('home.continueReadingAction') }}
          </RouterLink>
          <RouterLink
            class="bm-button"
            :to="{ name: 'book-detail', params: { id: continueReadingBook.id } }"
          >
            {{ t('home.openBookDetail') }}
          </RouterLink>
        </div>
      </div>

      <EmptyState
        v-else
        :title="t('home.noContinueReading')"
        :description="t('home.continueReadingSubtitle')"
      >
        <RouterLink
          class="bm-button bm-button-primary"
          to="/books"
        >
          {{ t('home.viewAllBooks') }}
        </RouterLink>
      </EmptyState>
    </SurfaceCard>

    <SurfaceCard>
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 class="bm-section-title">{{ t('home.yourBooksTitle') }}</h2>
          <p class="bm-muted text-xs">{{ t('home.yourBooksSubtitle') }}</p>
        </div>
        <RouterLink
          class="bm-button text-xs"
          to="/books"
        >
          {{ t('home.viewAllBooks') }}
          <ArrowRight
            :size="14"
            aria-hidden="true"
          />
        </RouterLink>
      </div>

      <p
        v-if="loadingLibrary"
        class="bm-muted text-sm"
      >
        {{ t('books.loadingLibrary') }}
      </p>

      <div
        v-else-if="previewBooks.length > 0"
        class="bm-book-grid"
      >
        <RouterLink
          v-for="item in previewBooks"
          :key="item.id"
          class="bm-book-card"
          :to="{ name: 'book-detail', params: { id: item.id } }"
        >
          <button
            type="button"
            class="absolute right-2 top-2 z-10 cursor-pointer rounded-full border bg-(--app-surface) px-2 py-1 text-sm shadow transition disabled:cursor-not-allowed disabled:opacity-60"
            :class="
              item.favorite
                ? 'border-(--app-danger) text-(--app-danger)'
                : 'border-(--app-border) text-(--app-text-muted) hover:text-(--app-danger)'
            "
            :disabled="isFavoriteUpdating(item.id)"
            @click.prevent.stop="onToggleFavorite(item.id)"
          >
            <span class="text-sm leading-none">{{ item.favorite ? '♥' : '♡' }}</span>
          </button>
          <div class="bm-book-cover">
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
          </div>

          <div class="space-y-1 p-3">
            <p class="line-clamp-2 min-h-10 font-serif text-sm font-semibold text-(--app-text)">
              {{ item.title }}
            </p>
            <p class="bm-muted line-clamp-1 text-[11px]">
              {{ t('books.by') }} {{ item.authors.join(', ') || t('books.unknownAuthor') }}
            </p>
          </div>
        </RouterLink>
      </div>

      <EmptyState
        v-else
        :title="t('books.emptyLibrary')"
        :description="t('home.yourBooksSubtitle')"
      >
        <RouterLink
          class="bm-button bm-button-primary"
          to="/books"
        >
          {{ t('books.openAddModal') }}
        </RouterLink>
      </EmptyState>
    </SurfaceCard>
  </div>
</template>
