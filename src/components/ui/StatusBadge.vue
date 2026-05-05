<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'warning' | 'danger'
  }>(),
  {
    tone: 'neutral',
  },
)
</script>

<template>
  <span
    class="bm-badge"
    :class="{
      'bm-badge-success': tone === 'success',
      'bm-badge-warning': tone === 'warning',
      'bm-badge-danger': tone === 'danger',
    }"
  >
    <slot />
  </span>
</template>
