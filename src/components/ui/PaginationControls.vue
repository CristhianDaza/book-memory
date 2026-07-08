<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { BooksPageSize } from '../../composables/useBooksPagination'

const props = defineProps<{
  page: number
  pageSize: BooksPageSize
  pageSizeOptions: readonly BooksPageSize[]
  totalItems: number
}>()

const emit = defineEmits<{
  'update:page': [value: number]
  'update:pageSize': [value: BooksPageSize]
}>()

const { t } = useI18n()

const totalPages = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)))
const currentPage = computed(() => Math.min(Math.max(1, props.page), totalPages.value))
const hasMultiplePages = computed(() => totalPages.value > 1)
const rangeStart = computed(() => (props.totalItems === 0 ? 0 : (currentPage.value - 1) * props.pageSize + 1))
const rangeEnd = computed(() => Math.min(currentPage.value * props.pageSize, props.totalItems))

const visiblePages = computed(() => {
  const pages = new Set<number>([1, totalPages.value, currentPage.value])
  if (currentPage.value > 1) pages.add(currentPage.value - 1)
  if (currentPage.value < totalPages.value) pages.add(currentPage.value + 1)
  return [...pages].sort((a, b) => a - b)
})

function setPage(value: number) {
  emit('update:page', Math.min(Math.max(1, value), totalPages.value))
}

function setPageSize(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:pageSize', Number(target.value) as BooksPageSize)
}
</script>

<template>
  <nav
    v-if="totalItems > 0"
    class="bm-pagination"
    :aria-label="t('books.paginationLabel')"
  >
    <p class="bm-pagination-summary">
      {{
        t('books.paginationSummary', {
          start: rangeStart,
          end: rangeEnd,
          total: totalItems,
        })
      }}
    </p>

    <label class="bm-pagination-size">
      <span>{{ t('books.itemsPerPage') }}</span>
      <select
        class="bm-select bm-pagination-select"
        :value="pageSize"
        @change="setPageSize"
      >
        <option
          v-for="option in pageSizeOptions"
          :key="option"
          :value="option"
        >
          {{ option }}
        </option>
      </select>
    </label>

    <div class="bm-pagination-pages">
      <button
        type="button"
        class="bm-pagination-button"
        :disabled="!hasMultiplePages || currentPage === 1"
        :aria-label="t('books.previousPage')"
        @click="setPage(currentPage - 1)"
      >
        <ChevronLeft
          :size="16"
          aria-hidden="true"
        />
      </button>

      <button
        v-for="pageNumber in visiblePages"
        :key="pageNumber"
        type="button"
        class="bm-pagination-button bm-pagination-number"
        :class="{ 'is-active': pageNumber === currentPage }"
        :aria-current="pageNumber === currentPage ? 'page' : undefined"
        @click="setPage(pageNumber)"
      >
        {{ pageNumber }}
      </button>

      <button
        type="button"
        class="bm-pagination-button"
        :disabled="!hasMultiplePages || currentPage === totalPages"
        :aria-label="t('books.nextPage')"
        @click="setPage(currentPage + 1)"
      >
        <ChevronRight
          :size="16"
          aria-hidden="true"
        />
      </button>
    </div>
  </nav>
</template>
