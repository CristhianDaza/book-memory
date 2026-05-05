<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="bm-page-header">
    <div>
      <p class="bm-eyebrow">{{ eyebrow }}</p>
      <h1 class="bm-title mt-2">{{ title }}</h1>
      <p
        v-if="subtitle"
        class="bm-muted mt-2 max-w-2xl text-sm sm:text-base"
      >
        {{ subtitle }}
      </p>
    </div>
    <slot name="actions" />
  </header>
</template>
