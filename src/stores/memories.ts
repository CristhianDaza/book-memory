import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createMemory, deleteMemory, fetchMemories, updateMemory } from '../services/memoryService'
import type { BookMemory, BookMemoryKind, CreateBookMemoryInput, UpdateBookMemoryInput } from '../types/memories'
import {
  isMemoryDue,
  nextReviewDateForForgotten,
  nextReviewDateForRemembered,
  normalizeMemoryTags,
} from '../utils/memories'
import { useAuthStore } from './auth'

export const useMemoriesStore = defineStore('memories', () => {
  const memories = ref<BookMemory[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const deletingIds = ref<string[]>([])
  const errorKey = ref<string | null>(null)
  const loadedUid = ref<string | null>(null)
  const searchQuery = ref('')
  const selectedBookId = ref<string>('all')
  const selectedKind = ref<BookMemoryKind | 'all'>('all')
  const selectedTag = ref<string>('all')
  const showOnlyFavorites = ref(false)
  const showOnlyDue = ref(false)
  let loadPromise: Promise<void> | null = null

  const allTags = computed(() => {
    const tags = new Set<string>()
    memories.value.forEach((memory) => memory.tags.forEach((tag) => tags.add(tag)))
    return Array.from(tags).sort((a, b) => a.localeCompare(b))
  })

  const dueMemories = computed(() => memories.value.filter((memory) => isMemoryDue(memory)))

  const filteredMemories = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    return memories.value.filter((memory) => {
      if (selectedBookId.value !== 'all' && memory.bookId !== selectedBookId.value) return false
      if (selectedKind.value !== 'all' && memory.kind !== selectedKind.value) return false
      if (selectedTag.value !== 'all' && !memory.tags.includes(selectedTag.value)) return false
      if (showOnlyFavorites.value && !memory.favorite) return false
      if (showOnlyDue.value && !isMemoryDue(memory)) return false
      if (!query) return true
      return (
        memory.content.toLowerCase().includes(query) ||
        memory.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    })
  })

  function resetCache() {
    memories.value = []
    loadedUid.value = null
    loadPromise = null
  }

  function clearError() {
    errorKey.value = null
  }

  async function ensureMemoriesLoaded(options?: { force?: boolean }) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      resetCache()
      return
    }
    if (!options?.force && loadedUid.value === uid) return
    if (loadPromise) {
      await loadPromise
      return
    }

    clearError()
    loading.value = true
    loadPromise = (async () => {
      try {
        memories.value = await fetchMemories(uid)
        loadedUid.value = uid
      } catch {
        errorKey.value = 'memories.loadError'
      } finally {
        loading.value = false
        loadPromise = null
      }
    })()
    await loadPromise
  }

  async function addMemory(payload: CreateBookMemoryInput) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'memories.authRequired'
      return
    }
    const content = payload.content.trim()
    if (!content) {
      errorKey.value = 'memories.contentRequired'
      return
    }

    clearError()
    saving.value = true
    try {
      const created = await createMemory(uid, {
        ...payload,
        content,
        tags: normalizeMemoryTags(payload.tags),
      })
      memories.value = [created, ...memories.value.filter((memory) => memory.id !== created.id)]
      loadedUid.value = uid
    } catch {
      errorKey.value = 'memories.saveError'
    } finally {
      saving.value = false
    }
  }

  async function editMemory(memoryId: string, payload: UpdateBookMemoryInput) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'memories.authRequired'
      return
    }
    const previous = memories.value.find((memory) => memory.id === memoryId)
    if (!previous) return

    clearError()
    const normalizedPayload: UpdateBookMemoryInput = { ...payload }
    if (payload.tags !== undefined) {
      normalizedPayload.tags = normalizeMemoryTags(payload.tags)
    }
    memories.value = memories.value.map((memory) =>
      memory.id === memoryId ? { ...memory, ...normalizedPayload, updatedAt: new Date() } : memory,
    )
    try {
      await updateMemory(uid, memoryId, normalizedPayload)
    } catch {
      memories.value = memories.value.map((memory) => (memory.id === memoryId ? previous : memory))
      errorKey.value = 'memories.saveError'
    }
  }

  async function removeMemory(memoryId: string) {
    const authStore = useAuthStore()
    const uid = authStore.user?.uid
    if (!uid) {
      errorKey.value = 'memories.authRequired'
      return
    }
    const previous = memories.value
    clearError()
    deletingIds.value = [...deletingIds.value, memoryId]
    memories.value = memories.value.filter((memory) => memory.id !== memoryId)
    try {
      await deleteMemory(uid, memoryId)
    } catch {
      memories.value = previous
      errorKey.value = 'memories.deleteError'
    } finally {
      deletingIds.value = deletingIds.value.filter((id) => id !== memoryId)
    }
  }

  async function markRemembered(memoryId: string) {
    await editMemory(memoryId, {
      reviewStatus: 'reviewed',
      nextReviewAt: nextReviewDateForRemembered(),
    })
  }

  async function markForgotten(memoryId: string) {
    await editMemory(memoryId, {
      reviewStatus: 'pending',
      nextReviewAt: nextReviewDateForForgotten(),
    })
  }

  function getMemoriesForBook(bookId: string): BookMemory[] {
    return memories.value.filter((memory) => memory.bookId === bookId)
  }

  function setFilters(filters: Partial<{
    searchQuery: string
    selectedBookId: string
    selectedKind: BookMemoryKind | 'all'
    selectedTag: string
    showOnlyFavorites: boolean
    showOnlyDue: boolean
  }>) {
    if (filters.searchQuery !== undefined) searchQuery.value = filters.searchQuery
    if (filters.selectedBookId !== undefined) selectedBookId.value = filters.selectedBookId
    if (filters.selectedKind !== undefined) selectedKind.value = filters.selectedKind
    if (filters.selectedTag !== undefined) selectedTag.value = filters.selectedTag
    if (filters.showOnlyFavorites !== undefined) showOnlyFavorites.value = filters.showOnlyFavorites
    if (filters.showOnlyDue !== undefined) showOnlyDue.value = filters.showOnlyDue
  }

  return {
    memories,
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
    allTags,
    dueMemories,
    filteredMemories,
    ensureMemoriesLoaded,
    addMemory,
    editMemory,
    removeMemory,
    markRemembered,
    markForgotten,
    getMemoriesForBook,
    setFilters,
    clearError,
  }
})
