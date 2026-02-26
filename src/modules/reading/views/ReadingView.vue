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

const { library } = storeToRefs(booksStore)
const selectedBookId = computed(() => String(route.query.bookId ?? ''))
const selectedBook = computed(() => library.value.find((book) => book.id === selectedBookId.value) ?? null)

onMounted(async () => {
  await booksStore.ensureLibraryLoaded()
})
</script>

<template>
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('modules.readingLabel') }}</p>
    <h1 class="mt-2 text-2xl font-semibold text-white">{{ t('modules.readingTitle') }}</h1>
    <p class="mt-3 text-sm text-slate-300">{{ t('modules.readingBody') }}</p>

    <div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p class="text-xs uppercase tracking-wide text-slate-400">{{ t('reading.selectedBook') }}</p>
      <p class="mt-1 font-serif text-lg text-slate-100">
        {{ selectedBook?.title ?? t('reading.noBookSelected') }}
      </p>

      <button
        v-if="selectedBook"
        type="button"
        class="mt-3 cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800"
        @click="router.push({ name: 'book-detail', params: { id: selectedBook.id } })"
      >
        {{ t('reading.viewBookDetail') }}
      </button>
    </div>
  </section>
</template>
