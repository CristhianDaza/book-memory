<script setup lang="ts">
import { computed } from 'vue'
import type { PromptModalEmits, PromptModalProps } from '../types/components'
import { withBodyScrollLock } from '../composables/useBodyScrollLock'

const props = withDefaults(defineProps<PromptModalProps>(), {
  message: '',
  inputLabel: '',
  inputPlaceholder: '',
  inputType: 'text',
  inputMin: '',
  loading: false,
})

const emit = defineEmits<PromptModalEmits>()

function onCancel() {
  emit('cancel')
}

function onConfirm() {
  emit('confirm')
}

function onUpdateValue(value: string) {
  emit('update:value', value)
}

withBodyScrollLock(computed(() => props.open))
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-[55] flex items-end bg-slate-950/80 p-3 sm:items-center sm:justify-center"
    @click.self="onCancel"
  >
    <section class="flex max-h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl sm:p-6">
      <div class="overflow-y-auto pr-1">
        <h3 class="text-lg font-semibold text-white">
          {{ title }}
        </h3>
        <p
          v-if="message"
          class="mt-1 text-sm text-slate-300"
        >
          {{ message }}
        </p>

        <label
          v-if="inputLabel"
          class="mt-3 block text-xs text-slate-300"
        >
          {{ inputLabel }}
          <input
            :value="value"
            :type="inputType"
            :min="inputMin || undefined"
            :placeholder="inputPlaceholder || undefined"
            class="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-400 focus:ring-2"
            @input="onUpdateValue(($event.target as HTMLInputElement).value)"
          >
        </label>

        <slot name="details" />
      </div>

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
            class="cursor-pointer rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="loading"
            @click="onConfirm"
          >
            {{ confirmLabel }}
          </button>
      </div>
    </section>
  </div>
</template>
