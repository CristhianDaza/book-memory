<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '../../../components/ui/EmptyState.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import PaginationControls from '../../../components/ui/PaginationControls.vue'
import StarRating from '../../../components/ui/StarRating.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
import { useBooksPaginationPreference } from '../../../composables/useBooksPagination'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'

const { t } = useI18n()
const booksStore = useBooksStore()
const notificationsStore = useNotificationsStore()
const { pageSize, pageSizeModel, pageSizeOptions, setPageSize } = useBooksPaginationPreference()
const { library, loadingLibrary, metadataUpdatingIds } = storeToRefs(booksStore)
const finishedBooksPage = ref(1)
const abandonedBooksPage = ref(1)

function toMillis(value: unknown): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
  }
  if (typeof value === 'object' && 'toDate' in value) {
    const dateLike = value as { toDate?: () => Date }
    if (typeof dateLike.toDate !== 'function') return 0
    return dateLike.toDate().getTime()
  }
  return 0
}

const finishedBooks = computed(() =>
  library.value
    .filter((book) => book.status === 'finished')
    .sort((a, b) => {
      const bTime = toMillis(b.completedAt) || toMillis(b.updatedAt)
      const aTime = toMillis(a.completedAt) || toMillis(a.updatedAt)
      if (bTime !== aTime) return bTime - aTime
      return a.title.localeCompare(b.title)
    }),
)
const abandonedBooks = computed(() =>
  library.value
    .filter((book) => book.status === 'abandoned')
    .sort((a, b) => {
      const bTime = toMillis(b.updatedAt)
      const aTime = toMillis(a.updatedAt)
      if (bTime !== aTime) return bTime - aTime
      return a.title.localeCompare(b.title)
    }),
)
const paginatedFinishedBooks = computed(() => {
  const start = (finishedBooksPage.value - 1) * pageSize.value
  return finishedBooks.value.slice(start, start + pageSize.value)
})
const paginatedAbandonedBooks = computed(() => {
  const start = (abandonedBooksPage.value - 1) * pageSize.value
  return abandonedBooks.value.slice(start, start + pageSize.value)
})

function formatCompletedAt(value: unknown): string {
  const millis = toMillis(value)
  if (!millis) return t('books.completedAtUnknown')
  return new Date(millis).toLocaleDateString()
}

function isUpdating(bookId: string): boolean {
  return metadataUpdatingIds.value.includes(bookId)
}

function onPageSizeChange(value: number) {
  setPageSize(value)
  finishedBooksPage.value = 1
  abandonedBooksPage.value = 1
}

async function onRetryAbandoned(bookId: string) {
  const target = library.value.find((book) => book.id === bookId)
  if (!target) return
  await booksStore.updateBookMetadata(bookId, {
    coverUrl: target.coverUrl,
    totalPages: target.totalPages,
    currentPage: target.currentPage,
    status: 'wishlist',
    rating: target.rating,
    note: target.note,
    abandonedReason: null,
  })
  if (booksStore.errorKey) {
    notificationsStore.error(t(booksStore.errorKey))
    return
  }
  notificationsStore.success(t('notifications.abandonedBookRetried'))
}

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
})

watch([finishedBooks, pageSize], () => {
  const totalPages = Math.max(1, Math.ceil(finishedBooks.value.length / pageSize.value))
  if (finishedBooksPage.value > totalPages) {
    finishedBooksPage.value = totalPages
  }
})

watch([abandonedBooks, pageSize], () => {
  const totalPages = Math.max(1, Math.ceil(abandonedBooks.value.length / pageSize.value))
  if (abandonedBooksPage.value > totalPages) {
    abandonedBooksPage.value = totalPages
  }
})

watch(pageSize, () => {
  finishedBooksPage.value = 1
  abandonedBooksPage.value = 1
})
</script>

<template>
  <section class="bm-page">
    <PageHeader
      :eyebrow="t('modules.achievementsLabel')"
      :title="t('books.finishedBooksTitle')"
      :subtitle="t('books.finishedBooksSubtitle')"
    />

    <SurfaceCard>
      <p
        v-if="loadingLibrary"
        class="bm-muted text-sm"
      >
        {{ t('books.loadingLibrary') }}
      </p>

      <TransitionGroup
        v-else-if="finishedBooks.length > 0"
        name="bm-stagger"
        tag="div"
        class="bm-book-grid"
      >
        <RouterLink
          v-for="(item, index) in paginatedFinishedBooks"
          :key="item.id"
          class="bm-book-card"
          :style="{ transitionDelay: `${Math.min(index, 10) * 24}ms` }"
          :to="{ name: 'book-detail', params: { id: item.id } }"
        >
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
            <div v-if="item.rating !== null">
              <StarRating
                :model-value="item.rating"
                readonly
                :size="14"
              />
            </div>
            <p class="bm-soft text-[11px]">
              {{ t('books.completedAtLabel') }}: {{ formatCompletedAt(item.completedAt ?? item.updatedAt) }}
            </p>
          </div>
        </RouterLink>
      </TransitionGroup>

      <PaginationControls
        v-if="!loadingLibrary && finishedBooks.length > 0"
        v-model:page="finishedBooksPage"
        :page-size="pageSizeModel"
        :page-size-options="pageSizeOptions"
        :total-items="finishedBooks.length"
        class="mt-4"
        @update:page-size="onPageSizeChange"
      />

      <EmptyState
        v-else
        :title="t('books.finishedBooksEmptyTitle')"
        :description="t('books.finishedBooksEmptySubtitle')"
      />
    </SurfaceCard>

    <SurfaceCard>
      <div class="mb-3">
        <h2 class="bm-section-title">{{ t('books.abandonedRetryTitle') }}</h2>
        <p class="bm-muted text-xs">{{ t('books.abandonedRetrySubtitle') }}</p>
      </div>

      <TransitionGroup
        v-if="abandonedBooks.length > 0"
        name="bm-stagger"
        tag="div"
        class="bm-book-grid"
      >
        <article
          v-for="(item, index) in paginatedAbandonedBooks"
          :key="item.id"
          class="bm-book-card"
          :style="{ transitionDelay: `${Math.min(index, 10) * 24}ms` }"
        >
          <RouterLink :to="{ name: 'book-detail', params: { id: item.id } }">
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
          </RouterLink>
          <div class="space-y-2 p-3">
            <RouterLink
              class="block"
              :to="{ name: 'book-detail', params: { id: item.id } }"
            >
              <p class="line-clamp-2 min-h-10 font-serif text-sm font-semibold text-(--app-text)">
                {{ item.title }}
              </p>
              <p class="bm-muted line-clamp-1 text-[11px]">
                {{ t('books.by') }} {{ item.authors.join(', ') || t('books.unknownAuthor') }}
              </p>
              <p
                v-if="item.abandonedReason"
                class="bm-soft line-clamp-2 text-[11px]"
              >
                {{ item.abandonedReason }}
              </p>
            </RouterLink>
            <button
              type="button"
              class="bm-button bm-button-primary w-full text-xs"
              :disabled="isUpdating(item.id)"
              @click="onRetryAbandoned(item.id)"
            >
              {{ t('books.retryAbandonedAction') }}
            </button>
          </div>
        </article>
      </TransitionGroup>

      <PaginationControls
        v-if="abandonedBooks.length > 0"
        v-model:page="abandonedBooksPage"
        :page-size="pageSizeModel"
        :page-size-options="pageSizeOptions"
        :total-items="abandonedBooks.length"
        class="mt-4"
        @update:page-size="onPageSizeChange"
      />

      <EmptyState
        v-else
        :title="t('books.abandonedEmptyTitle')"
        :description="t('books.abandonedEmptySubtitle')"
      />
    </SurfaceCard>
  </section>
</template>
