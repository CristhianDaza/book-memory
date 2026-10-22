<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="bm-page-header">
    <div class="bm-page-heading">
      <p class="bm-eyebrow">{{ eyebrow }}</p>
      <h1 class="bm-title mt-2">{{ title }}</h1>
      <p
        v-if="subtitle"
        class="bm-muted mt-2 max-w-2xl text-sm sm:text-base"
      >
        {{ subtitle }}
      </p>
    </div>
    <div v-if="$slots.actions" class="bm-page-actions">
      <slot name="actions" />
    </div>
  </header>
</template>
