<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { BookOpen, Check, Heart, RotateCcw, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import EmptyState from '../../../components/ui/EmptyState.vue'
import PageHeader from '../../../components/ui/PageHeader.vue'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
import { useBooksStore } from '../../../stores/books'
import { useMemoriesStore } from '../../../stores/memories'
import { useNotificationsStore } from '../../../stores/notifications'
import type { BookMemory, BookMemoryKind, CreateBookMemoryInput } from '../../../types/memories'
import { memoryKinds, toDate } from '../../../utils/memories'
import QuickMemoryForm from '../components/QuickMemoryForm.vue'

const { t, locale } = useI18n()
const booksStore = useBooksStore()
const memoriesStore = useMemoriesStore()
const notificationsStore = useNotificationsStore()
const { library } = storeToRefs(booksStore)
const {
  loading,
  saving,
  deletingIds,
  errorKey,
  searchQuery,
  selectedBookId,
  selectedKind,
  selectedTag,
  showOnlyFavorites,
  showOnlyDue,
  filteredMemories,
  dueMemories,
  allTags,
} = storeToRefs(memoriesStore)

const firstBookId = computed(() => library.value[0]?.id ?? '')
const booksById = computed(() => new Map(library.value.map((book) => [book.id, book])))
const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))

function bookTitle(bookId: string): string {
  return booksById.value.get(bookId)?.title ?? t('memories.unknownBook')
}

function formatReviewDate(value: unknown): string {
  const date = toDate(value)
  if (!date) return t('memories.reviewNow')
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(date)
}

function memoryTone(memory: BookMemory): 'success' | 'warning' | 'danger' {
  return dueMemories.value.some((entry) => entry.id === memory.id) ? 'warning' : 'success'
}

async function onCreateMemory(payload: CreateBookMemoryInput) {
  await memoriesStore.addMemory(payload)
  if (memoriesStore.errorKey) {
    notificationsStore.error(t(memoriesStore.errorKey))
    return
  }
  notificationsStore.success(t('memories.saved'))
}

async function onToggleFavorite(memory: BookMemory) {
  await memoriesStore.editMemory(memory.id, { favorite: !memory.favorite })
}

async function onRemembered(memoryId: string) {
  await memoriesStore.markRemembered(memoryId)
  notificationsStore.success(t('memories.rememberedSaved'))
}

async function onForgotten(memoryId: string) {
  await memoriesStore.markForgotten(memoryId)
  notificationsStore.info(t('memories.forgottenSaved'))
}

async function onDelete(memoryId: string) {
  await memoriesStore.removeMemory(memoryId)
}

onMounted(async () => {
  await Promise.all([booksStore.ensureLibraryLoaded(), memoriesStore.ensureMemoriesLoaded()])
})
</script>

<template>
  <div class="bm-page">
    <PageHeader
      :eyebrow="t('modules.memoriesLabel')"
      :title="t('memories.title')"
      :subtitle="t('memories.subtitle')"
    >
      <template #actions>
        <StatusBadge :tone="dueMemories.length > 0 ? 'warning' : 'success'">
          {{ t('memories.dueCount', { count: dueMemories.length }) }}
        </StatusBadge>
      </template>
    </PageHeader>

    <SurfaceCard>
      <QuickMemoryForm
        v-if="firstBookId"
        :book-id="firstBookId"
        :saving="saving"
        @save="onCreateMemory"
      />
      <EmptyState
        v-else
        :title="t('memories.noBooksTitle')"
        :description="t('memories.noBooksSubtitle')"
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
      <div class="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem]">
        <label class="bm-label">
          {{ t('memories.searchLabel') }}
          <input
            v-model="searchQuery"
            type="search"
            class="bm-input mt-1 text-sm"
            :placeholder="t('memories.searchPlaceholder')"
          >
        </label>

        <label class="bm-label">
          {{ t('memories.bookFilter') }}
          <select
            v-model="selectedBookId"
            class="bm-select mt-1 text-sm"
          >
            <option value="all">{{ t('memories.allBooks') }}</option>
            <option
              v-for="book in library"
              :key="book.id"
              :value="book.id"
            >
              {{ book.title }}
            </option>
          </select>
        </label>

        <label class="bm-label">
          {{ t('memories.kindLabel') }}
          <select
            v-model="selectedKind"
            class="bm-select mt-1 text-sm"
          >
            <option value="all">{{ t('memories.allKinds') }}</option>
            <option
              v-for="kind in memoryKinds"
              :key="kind"
              :value="kind"
            >
              {{ t(`memories.kind_${kind as BookMemoryKind}`) }}
            </option>
          </select>
        </label>

        <label class="bm-label">
          {{ t('memories.tagFilter') }}
          <select
            v-model="selectedTag"
            class="bm-select mt-1 text-sm"
          >
            <option value="all">{{ t('memories.allTags') }}</option>
            <option
              v-for="tag in allTags"
              :key="tag"
              :value="tag"
            >
              {{ tag }}
            </option>
          </select>
        </label>
      </div>

      <div class="mt-3 flex flex-wrap gap-3">
        <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-(--app-text-muted)">
          <input
            v-model="showOnlyFavorites"
            type="checkbox"
            class="h-4 w-4 rounded border-(--app-border) accent-(--app-primary)"
          >
          {{ t('memories.onlyFavorites') }}
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-(--app-text-muted)">
          <input
            v-model="showOnlyDue"
            type="checkbox"
            class="h-4 w-4 rounded border-(--app-border) accent-(--app-primary)"
          >
          {{ t('memories.onlyDue') }}
        </label>
      </div>

      <p
        v-if="mappedError"
        class="mt-3 rounded-lg border border-(--app-danger) bg-(--app-danger-soft) p-2 text-xs text-(--app-danger)"
      >
        {{ mappedError }}
      </p>

      <p
        v-if="loading"
        class="bm-muted mt-4 text-sm"
      >
        {{ t('memories.loading') }}
      </p>

      <TransitionGroup
        v-else-if="filteredMemories.length > 0"
        name="bm-stagger"
        tag="div"
        class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2"
      >
        <article
          v-for="(memory, index) in filteredMemories"
          :key="memory.id"
          class="bm-card"
          :style="{ transitionDelay: `${Math.min(index, 10) * 24}ms` }"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <StatusBadge :tone="memoryTone(memory)">
                {{ t(`memories.kind_${memory.kind}`) }}
              </StatusBadge>
              <p class="bm-muted mt-2 flex items-center gap-1 text-xs">
                <BookOpen
                  :size="14"
                  aria-hidden="true"
                />
                {{ bookTitle(memory.bookId) }}
                <template v-if="memory.page !== null">- {{ t('memories.pageShort', { page: memory.page }) }}</template>
              </p>
            </div>
            <button
              type="button"
              class="bm-icon-button"
              :aria-label="t('memories.favoriteLabel')"
              @click="onToggleFavorite(memory)"
            >
              <Heart
                :size="16"
                :fill="memory.favorite ? 'currentColor' : 'none'"
                aria-hidden="true"
              />
            </button>
          </div>

          <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-(--app-text)">
            {{ memory.content }}
          </p>

          <div
            v-if="memory.tags.length > 0"
            class="mt-3 flex flex-wrap gap-1"
          >
            <span
              v-for="tag in memory.tags"
              :key="tag"
              class="rounded-full border border-(--app-border) px-2 py-0.5 text-[11px] font-semibold text-(--app-text-muted)"
            >
              #{{ tag }}
            </span>
          </div>

          <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p class="bm-soft text-xs">
              {{ t('memories.nextReview') }}: {{ formatReviewDate(memory.nextReviewAt) }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="bm-button bm-button-success text-xs"
                @click="onRemembered(memory.id)"
              >
                <Check
                  :size="14"
                  aria-hidden="true"
                />
                {{ t('memories.remembered') }}
              </button>
              <button
                type="button"
                class="bm-button text-xs"
                @click="onForgotten(memory.id)"
              >
                <RotateCcw
                  :size="14"
                  aria-hidden="true"
                />
                {{ t('memories.forgotten') }}
              </button>
              <button
                type="button"
                class="bm-button bm-button-danger text-xs"
                :disabled="deletingIds.includes(memory.id)"
                @click="onDelete(memory.id)"
              >
                <Trash2
                  :size="14"
                  aria-hidden="true"
                />
                {{ t('memories.deleteAction') }}
              </button>
            </div>
          </div>
        </article>
      </TransitionGroup>

      <EmptyState
        v-else
        class="mt-4"
        :title="t('memories.emptyTitle')"
        :description="t('memories.emptySubtitle')"
      />
    </SurfaceCard>
  </div>
</template>
