<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useBooksStore } from '../stores/books'

const authStore = useAuthStore()
const booksStore = useBooksStore()
const { t } = useI18n()

const { user } = storeToRefs(authStore)
const { library, loadingLibrary, favoriteUpdatingIds } = storeToRefs(booksStore)
const totalBooks = computed(() => library.value.length)
const favoriteBooks = computed(() => library.value.filter((book) => book.favorite).length)
const readingBooks = computed(() => library.value.filter((book) => book.status === 'reading').length)
const previewBooks = computed(() =>
  [...library.value]
    .sort((a, b) => {
      const favoriteDiff = Number(b.favorite) - Number(a.favorite)
      if (favoriteDiff !== 0) return favoriteDiff
      return a.title.localeCompare(b.title)
    })
    .slice(0, 5),
)

function isFavoriteUpdating(bookId: string): boolean {
  return favoriteUpdatingIds.value.includes(bookId)
}

async function onToggleFavorite(bookId: string) {
  await booksStore.toggleFavorite(bookId)
}

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
})
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg sm:p-8">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('common.bookMemory') }}</p>
          <h1 class="mt-2 text-2xl font-semibold text-white sm:text-3xl">{{ t('home.libraryHubTitle') }}</h1>
          <p class="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            {{ t('home.libraryHubSubtitle') }}
          </p>
          <p class="mt-2 text-xs text-slate-400">{{ user?.email ?? t('home.fallbackUser') }}</p>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-3">
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('home.kpiBooks') }}</p>
          <p class="mt-1 text-xl font-semibold text-white">{{ totalBooks }}</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('home.kpiFavorites') }}</p>
          <p class="mt-1 text-xl font-semibold text-amber-300">{{ favoriteBooks }}</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('home.kpiReading') }}</p>
          <p class="mt-1 text-xl font-semibold text-cyan-300">{{ readingBooks }}</p>
        </article>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 class="text-lg font-semibold text-white">{{ t('home.yourBooksTitle') }}</h2>
          <p class="text-xs text-slate-400">{{ t('home.yourBooksSubtitle') }}</p>
        </div>
        <RouterLink
          class="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
          to="/books"
        >
          {{ t('home.viewAllBooks') }}
        </RouterLink>
      </div>

      <p v-if="loadingLibrary" class="text-sm text-slate-400">{{ t('books.loadingLibrary') }}</p>

      <div v-else-if="previewBooks.length > 0" class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <RouterLink
          v-for="item in previewBooks"
          :key="item.id"
          class="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70 transition hover:border-cyan-400"
          :to="{ name: 'book-detail', params: { id: item.id } }"
        >
          <button
            type="button"
            class="absolute right-2 top-2 z-10 cursor-pointer rounded-full border bg-slate-950/80 p-1.5 transition disabled:cursor-not-allowed disabled:opacity-60"
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
          <div class="relative aspect-[2/3] w-full bg-slate-900">
            <img v-if="item.coverUrl" :src="item.coverUrl" :alt="item.title" class="h-full w-full object-cover" />
            <div
              v-else
              class="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-slate-400"
            >
              {{ t('books.noCover') }}
            </div>
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
      </div>

      <div v-else class="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p class="text-sm text-slate-300">{{ t('books.emptyLibrary') }}</p>
        <RouterLink
          class="mt-3 inline-flex cursor-pointer rounded-lg border border-cyan-500/60 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
          to="/books"
        >
          {{ t('books.openAddModal') }}
        </RouterLink>
      </div>
    </section>
  </div>
</template>
