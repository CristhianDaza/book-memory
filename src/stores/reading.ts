import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useReadingStore = defineStore('reading', () => {
  const selectedBookId = ref<string>('')
  const sessionBookId = ref<string | null>(null)
  const startPage = ref<number>(0)
  const endPage = ref<number>(0)
  const elapsedSeconds = ref<number>(0)
  const sessionStartedAt = ref<Date | null>(null)
  const running = ref(false)
  let timer: ReturnType<typeof setInterval> | null = null

  const hasActiveSession = computed(() => sessionStartedAt.value !== null)

  function setSelectedBook(bookId: string) {
    selectedBookId.value = bookId
  }

  function setStartPage(value: number) {
    startPage.value = Math.max(0, Math.floor(value))
  }

  function setEndPage(value: number) {
    endPage.value = Math.max(0, Math.floor(value))
  }

  function startTimer() {
    if (!sessionStartedAt.value) {
      sessionStartedAt.value = new Date()
      sessionBookId.value = selectedBookId.value || null
    }
    if (running.value) return

    running.value = true
    timer = setInterval(() => {
      elapsedSeconds.value += 1
    }, 1000)
  }

  function pauseTimer() {
    running.value = false
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function resetSession() {
    pauseTimer()
    startPage.value = 0
    endPage.value = 0
    elapsedSeconds.value = 0
    sessionStartedAt.value = null
    sessionBookId.value = null
  }

  return {
    selectedBookId,
    sessionBookId,
    startPage,
    endPage,
    elapsedSeconds,
    sessionStartedAt,
    running,
    hasActiveSession,
    setSelectedBook,
    setStartPage,
    setEndPage,
    startTimer,
    pauseTimer,
    resetSession,
  }
})
