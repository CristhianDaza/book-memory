<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    tone?: 'neutral' | 'danger' | 'success' | 'warm'
    disabled?: boolean
  }>(),
  {
    tone: 'neutral',
    disabled: false,
  },
)

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="bm-icon-button"
    :class="{
      'text-[var(--app-danger)]': tone === 'danger',
      'text-[var(--app-success)]': tone === 'success',
      'text-[var(--app-warm)]': tone === 'warm',
    }"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
