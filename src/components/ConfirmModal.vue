<script setup lang="ts">
import type { ConfirmModalEmits, ConfirmModalProps } from '../types/components'

withDefaults(defineProps<ConfirmModalProps>(), {
  message: '',
  loading: false,
  danger: false,
})

const emit = defineEmits<ConfirmModalEmits>()

function onCancel() {
  emit('cancel')
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-end bg-slate-950/80 p-3 sm:items-center sm:justify-center"
    @click.self="onCancel"
  >
    <section class="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6">
      <h2 class="text-lg font-semibold text-white">{{ title }}</h2>
      <p v-if="message" class="mt-2 text-sm text-slate-300">{{ message }}</p>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="onCancel"
        >
          {{ cancelLabel }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
          :class="danger ? 'bg-rose-500 hover:bg-rose-400' : 'bg-cyan-500 hover:bg-cyan-400'"
          :disabled="loading"
          @click="onConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
