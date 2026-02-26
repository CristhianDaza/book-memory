<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AppLocale } from '../../../i18n'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'

const { t, locale } = useI18n()
const booksStore = useBooksStore()
const authStore = useAuthStore()
const queryInput = ref('')

const { searchResults, library, searching, loadingLibrary, savingIds, errorKey } =
  storeToRefs(booksStore)
const { isAuthenticated } = storeToRefs(authStore)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))

async function onSearchSubmit() {
  await booksStore.search(queryInput.value, locale.value as AppLocale)
}

function onClearSearch() {
  queryInput.value = ''
  booksStore.clearSearch()
}

function isSaving(bookId: string): boolean {
  return savingIds.value.includes(bookId)
}

onMounted(async () => {
  await booksStore.loadLibrary()
})
</script>

<template>
  <div class="space-y-4">
    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('modules.booksLabel') }}</p>
      <h1 class="mt-2 text-2xl font-semibold text-white">{{ t('books.title') }}</h1>
      <p class="mt-3 text-sm text-slate-300">{{ t('books.subtitle') }}</p>

      <form class="mt-5 space-y-2" @submit.prevent="onSearchSubmit">
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

      <p v-if="mappedError" class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200">
        {{ mappedError }}
      </p>

      <div class="mt-5 space-y-3">
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
              @click="booksStore.addSearchResultToLibrary(book)"
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

    <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
      <h2 class="text-lg font-semibold text-white">{{ t('books.yourLibrary') }}</h2>
      <p v-if="loadingLibrary" class="mt-3 text-sm text-slate-400">{{ t('books.loadingLibrary') }}</p>

      <div v-else class="mt-3 space-y-2">
        <article
          v-for="item in library"
          :key="item.id"
          class="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
        >
          <div class="flex gap-3">
            <img
              v-if="item.coverUrl"
              :src="item.coverUrl"
              :alt="item.title"
              class="h-20 w-14 rounded-md border border-slate-700 object-cover shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            />
            <div
              v-else
              class="flex h-20 w-14 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-[10px] text-slate-400"
            >
              {{ t('books.noCover') }}
            </div>
            <div class="min-w-0">
              <p class="line-clamp-2 font-serif text-base font-semibold tracking-wide text-slate-100">
                {{ item.title }}
              </p>
              <p class="text-xs text-slate-400">
                {{ t('books.by') }} {{ item.authors.join(', ') || t('books.unknownAuthor') }}
              </p>
              <p class="mt-1 text-xs text-slate-500">
                {{ t('books.pages') }}: {{ item.totalPages ?? t('books.unknownPages') }}
              </p>
            </div>
          </div>
        </article>

        <p v-if="library.length === 0" class="text-sm text-slate-400">
          {{ t('books.emptyLibrary') }}
        </p>
      </div>
    </section>
  </div>
</template>
