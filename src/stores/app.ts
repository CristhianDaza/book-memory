import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const appName = ref('bookMemory')
  const uiMode = ref<'mobile-first'>('mobile-first')

  const mobileFirst = computed(() => uiMode.value === 'mobile-first')

  return {
    appName,
    uiMode,
    mobileFirst,
  }
})
