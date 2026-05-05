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
    class="bm-modal-backdrop z-[55]"
    @click.self="onCancel"
  >
    <section class="bm-modal-sheet flex max-h-[88dvh] max-w-md flex-col p-4 sm:p-6">
      <div class="overflow-y-auto pr-1">
        <h3 class="bm-section-title">
          {{ title }}
        </h3>
        <p
          v-if="message"
          class="bm-muted mt-1 text-sm"
        >
          {{ message }}
        </p>

        <label
          v-if="inputLabel"
          class="bm-label mt-3 block"
        >
          {{ inputLabel }}
          <input
            :value="value"
            :type="inputType"
            :min="inputMin || undefined"
            :placeholder="inputPlaceholder || undefined"
            class="bm-input mt-1 text-sm"
            @input="onUpdateValue(($event.target as HTMLInputElement).value)"
          >
        </label>

        <slot name="details" />
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="bm-button"
            :disabled="loading"
            @click="onCancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="bm-button bm-button-success"
            :disabled="loading"
            @click="onConfirm"
          >
            {{ confirmLabel }}
          </button>
      </div>
    </section>
  </div>
</template>
