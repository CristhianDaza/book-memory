import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AppNotification, NotificationType } from '../types/notification'

const DEFAULT_DURATION = 2800

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])

  function notify(message: string, type: NotificationType = 'info', duration = DEFAULT_DURATION) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    items.value = [...items.value, { id, type, message }]

    if (duration > 0) {
      window.setTimeout(() => {
        dismiss(id)
      }, duration)
    }
  }

  function success(message: string, duration?: number) {
    notify(message, 'success', duration)
  }

  function error(message: string, duration?: number) {
    notify(message, 'error', duration)
  }

  function info(message: string, duration?: number) {
    notify(message, 'info', duration)
  }

  function dismiss(id: string) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  return {
    items,
    notify,
    success,
    error,
    info,
    dismiss,
  }
})
