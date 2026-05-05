<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="bm-empty">
    <p class="bm-section-title">{{ title }}</p>
    <p
      v-if="description"
      class="bm-muted text-sm"
    >
      {{ description }}
    </p>
    <slot />
  </div>
</template>
