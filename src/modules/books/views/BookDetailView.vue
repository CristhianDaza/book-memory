<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '../../../stores/books'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()

const { favoriteUpdatingIds, deletingIds } = storeToRefs(booksStore)

const bookId = computed(() => String(route.params.id ?? ''))
const book = computed(() => booksStore.getLibraryBookById(bookId.value))

function isFavoriteUpdating() {
  return favoriteUpdatingIds.value.includes(bookId.value)
}

function isDeleting() {
  return deletingIds.value.includes(bookId.value)
}

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

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
  if (bookId.value) booksStore.selectLibraryBook(bookId.value)
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
          <p class="text-sm text-slate-400">{{ t('books.status') }}: {{ t(`books.status_${book.status}`) }}</p>
          <p class="text-sm" :class="book.favorite ? 'text-amber-300' : 'text-slate-400'">
            {{ book.favorite ? t('books.favorite') : t('books.notFavorite') }}
          </p>

          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
