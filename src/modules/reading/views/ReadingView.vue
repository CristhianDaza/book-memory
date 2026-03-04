<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import PromptModal from '../../../components/PromptModal.vue'
import { createReadingSession } from '../../../services/readingSessionService'
import { useAuthStore } from '../../../stores/auth'
import { useBooksStore } from '../../../stores/books'
import { useNotificationsStore } from '../../../stores/notifications'
import { useReadingStore } from '../../../stores/reading'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const booksStore = useBooksStore()
const readingStore = useReadingStore()
const notificationsStore = useNotificationsStore()

const { user } = storeToRefs(authStore)
const { library } = storeToRefs(booksStore)
const { selectedBookId, startPage, elapsedSeconds, running, hasActiveSession, sessionStartedAt } =
  storeToRefs(readingStore)

const saving = ref(false)
const localError = ref<string | null>(null)
const showFinishModal = ref(false)
const finishEndPage = ref<string>('0')

const selectedBook = computed(() => library.value.find((book) => book.id === selectedBookId.value) ?? null)
const formattedElapsed = computed(() => {
  const total = elapsedSeconds.value
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

const finishEndPageNumber = computed(() => {
  const parsed = Number(finishEndPage.value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
})

const remainingPages = computed(() => {
  if (!selectedBook.value?.totalPages) return null
  return Math.max(0, selectedBook.value.totalPages - finishEndPageNumber.value)
})

const remainingPercent = computed(() => {
  if (!selectedBook.value?.totalPages) return null
  const total = selectedBook.value.totalPages
  if (total <= 0) return null
  const remaining = Math.max(0, total - finishEndPageNumber.value)
  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)))
})

watch(selectedBook, (book) => {
  if (!book) return
  if (!hasActiveSession.value && startPage.value === 0) {
    readingStore.setStartPage(book.currentPage)
    readingStore.setEndPage(book.currentPage)
  }
})

async function loadContext() {
  await booksStore.ensureLibraryLoaded()

  const fromQuery = typeof route.query.bookId === 'string' ? route.query.bookId : ''
  const initialBookId = fromQuery || library.value[0]?.id || ''
  if (initialBookId) readingStore.setSelectedBook(initialBookId)
}

function onSelectBook(bookId: string) {
  readingStore.setSelectedBook(bookId)
  const selected = library.value.find((book) => book.id === bookId)
  if (!hasActiveSession.value && selected) {
    readingStore.setStartPage(selected.currentPage)
    readingStore.setEndPage(selected.currentPage)
  }
}

function onStart() {
  localError.value = null
  if (!selectedBook.value) {
    localError.value = t('reading.errorNoBook')
    notificationsStore.error(localError.value)
    return
  }
  readingStore.startTimer()
  notificationsStore.info(t('notifications.readingStarted'))
}

function onPause() {
  readingStore.pauseTimer()
  notificationsStore.info(t('notifications.readingPaused'))
}

function onReset() {
  readingStore.resetSession()
  if (selectedBook.value) {
    readingStore.setStartPage(selectedBook.value.currentPage)
    readingStore.setEndPage(selectedBook.value.currentPage)
  }
  notificationsStore.info(t('notifications.readingReset'))
}

function onOpenFinish() {
  localError.value = null
  if (!selectedBook.value || !user.value?.uid) {
    localError.value = t('reading.errorNoBook')
    notificationsStore.error(localError.value)
    return
  }
  if (!sessionStartedAt.value) {
    localError.value = t('reading.errorNoActive')
    notificationsStore.error(localError.value)
    return
  }
  finishEndPage.value = String(Math.max(startPage.value, selectedBook.value.currentPage))
  showFinishModal.value = true
}

function onCancelFinish() {
  showFinishModal.value = false
}

async function onConfirmFinish() {
  localError.value = null
  if (!selectedBook.value || !user.value?.uid) {
    localError.value = t('reading.errorNoBook')
    notificationsStore.error(localError.value)
    return
  }

  const start = Math.max(0, Math.floor(startPage.value))
  const end = finishEndPageNumber.value
  if (end < start) {
    localError.value = t('reading.errorEndBeforeStart')
    notificationsStore.error(localError.value)
    return
  }
  if (!sessionStartedAt.value) {
    localError.value = t('reading.errorNoActive')
    notificationsStore.error(localError.value)
    return
  }

  saving.value = true
  try {
    readingStore.pauseTimer()
    const now = new Date()
    const pagesRead = Math.max(0, end - start)
    readingStore.setEndPage(end)
    await createReadingSession(user.value.uid, {
      bookId: selectedBook.value.id,
      startedAt: sessionStartedAt.value,
      endedAt: now,
      durationSeconds: elapsedSeconds.value,
      startPage: start,
      endPage: end,
      pagesRead,
    })

    const totalPages = selectedBook.value.totalPages
    const status =
      totalPages !== null && end >= totalPages ? ('finished' as const) : ('reading' as const)

    await booksStore.updateBookMetadata(selectedBook.value.id, {
      totalPages,
      currentPage: end,
      status,
    })

    readingStore.resetSession()
    showFinishModal.value = false
    notificationsStore.success(t('notifications.readingSessionSaved'))
    await router.push({ name: 'book-detail', params: { id: selectedBook.value.id } })
  } catch (error) {
    localError.value = error instanceof Error ? error.message : t('reading.errorSaveSession')
    notificationsStore.error(localError.value)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadContext()
})
</script>

<template>
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">
      {{ t('modules.readingLabel') }}
    </p>
    <h1 class="mt-2 text-2xl font-semibold text-white">
      {{ t('reading.title') }}
    </h1>
    <p class="mt-2 text-sm text-slate-300">
      {{ t('reading.subtitle') }}
    </p>

    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="text-xs text-slate-300">
        {{ t('reading.selectBook') }}
        <select
          v-model="selectedBookId"
          class="mt-1 w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
          @change="onSelectBook(selectedBookId)"
        >
          <option
            v-for="book in library"
            :key="book.id"
            :value="book.id"
          >
            {{ book.title }}
          </option>
        </select>
      </label>

      <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
        <p class="text-xs uppercase tracking-wide text-slate-400">
          {{ t('reading.timer') }}
        </p>
        <p class="mt-1 font-mono text-2xl font-semibold text-cyan-300">
          {{ formattedElapsed }}
        </p>
      </div>
    </div>

    <div class="mt-3 grid grid-cols-1 gap-3">
      <label class="text-xs text-slate-300">
        {{ t('reading.startPage') }}
        <input
          :value="startPage"
          type="number"
          min="0"
          class="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
          @input="readingStore.setStartPage(Number(($event.target as HTMLInputElement).value))"
        >
      </label>
    </div>

    <p
      v-if="localError"
      class="mt-3 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200"
    >
      {{ localError }}
    </p>

    <div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <button
        type="button"
        class="cursor-pointer rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="running"
        @click="onStart"
      >
        {{ hasActiveSession ? t('reading.resume') : t('reading.start') }}
      </button>

      <button
        type="button"
        class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!running"
        @click="onPause"
      >
        {{ t('reading.pause') }}
      </button>

      <button
        type="button"
        class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!hasActiveSession || saving"
        @click="onReset"
      >
        {{ t('reading.reset') }}
      </button>

      <button
        type="button"
        class="cursor-pointer rounded-xl border border-emerald-500/60 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="!hasActiveSession || saving"
        @click="onOpenFinish"
      >
        {{ saving ? t('reading.savingSession') : t('reading.finish') }}
      </button>
    </div>

    <PromptModal
      :open="showFinishModal"
      :title="t('reading.finishStepTitle')"
      :message="t('reading.finishStepSubtitle')"
      :confirm-label="saving ? t('reading.savingSession') : t('reading.confirmFinish')"
      :cancel-label="t('reading.cancelFinish')"
      :value="finishEndPage"
      :input-label="t('reading.endPage')"
      input-type="number"
      input-min="0"
      :loading="saving"
      @cancel="onCancelFinish"
      @confirm="onConfirmFinish"
      @update:value="finishEndPage = $event"
    >
      <template #details>
        <div class="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-300">
          <p>
            {{ t('reading.remainingPages') }}:
            {{ remainingPages === null ? t('reading.unknownRemaining') : remainingPages }}
          </p>
          <p class="mt-1">
            {{ t('reading.remainingPercent') }}:
            {{ remainingPercent === null ? t('reading.unknownRemaining') : `${remainingPercent}%` }}
          </p>
        </div>
      </template>
    </PromptModal>
  </section>
</template>
