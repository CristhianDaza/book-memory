<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="bm-empty">
    <span class="bm-empty-icon"><BookOpen :size="24" aria-hidden="true" /></span>
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
