import { ref } from 'vue'

interface BookCompletionPayload {
  bookId: string
  title: string
  authors: string[]
  coverUrl?: string | null
}

const isVisible = ref(false)
const payload = ref<BookCompletionPayload | null>(null)

export function useBookCompletionOverlay() {
  function showBookCompletion(data: BookCompletionPayload) {
    payload.value = data
    isVisible.value = true
  }

  function hideBookCompletion() {
    isVisible.value = false
    setTimeout(() => {
      payload.value = null
    }, 300)
  }

  function isActive() {
    return isVisible.value
  }

  return {
    isVisible,
    payload,
    showBookCompletion,
    hideBookCompletion,
    isActive,
  }
}

export const bookCompletionOverlay = {
  isVisible,
  payload,
  showBookCompletion: (data: BookCompletionPayload) => {
    payload.value = data
    isVisible.value = true
  },
  hideBookCompletion: () => {
    isVisible.value = false
    setTimeout(() => {
      payload.value = null
    }, 300)
  },
  isActive: () => isVisible.value,
  hide: () => {
    isVisible.value = false
    setTimeout(() => {
      payload.value = null
    }, 300)
  },
}