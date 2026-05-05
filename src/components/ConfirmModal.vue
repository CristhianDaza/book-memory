<script setup lang="ts">
import { computed } from 'vue'
import type { ConfirmModalEmits, ConfirmModalProps } from '../types/components'
import { withBodyScrollLock } from '../composables/useBodyScrollLock'

const props = withDefaults(defineProps<ConfirmModalProps>(), {
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

withBodyScrollLock(computed(() => props.open))
</script>

<template>
  <div
    v-if="open"
    class="bm-modal-backdrop"
    @click.self="onCancel"
  >
    <section class="bm-modal-sheet max-w-md p-4 sm:p-6">
      <h2 class="bm-section-title">
        {{ title }}
      </h2>
      <p
        v-if="message"
        class="bm-muted mt-2 text-sm"
      >
        {{ message }}
      </p>

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
          class="bm-button"
          :class="danger ? 'bm-button-danger' : 'bm-button-primary'"
          :disabled="loading"
          @click="onConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>
