<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useNotificationsStore } from '../stores/notifications'
import type { NotificationType } from '../types/notification'

const notificationsStore = useNotificationsStore()
const { items } = storeToRefs(notificationsStore)

function toneClass(type: NotificationType) {
  if (type === 'success') return 'border-emerald-500/60 bg-emerald-950/80 text-emerald-100'
  if (type === 'error') return 'border-rose-500/60 bg-rose-950/80 text-rose-100'
  return 'border-cyan-500/60 bg-cyan-950/80 text-cyan-100'
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
    <TransitionGroup
      name="toast"
      tag="div"
      class="w-full max-w-md space-y-2"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-xl backdrop-blur"
        :class="toneClass(item.type)"
      >
        <div class="flex items-start justify-between gap-2">
          <p>{{ item.message }}</p>
          <button
            type="button"
            class="cursor-pointer rounded-md border border-current/30 px-1.5 py-0.5 text-xs transition hover:bg-black/20"
            @click="notificationsStore.dismiss(item.id)"
          >
            ×
          </button>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
