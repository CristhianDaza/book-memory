<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  to: string
  label: string
  active: boolean
  icon: Component
}>()
</script>

<template>
  <RouterLink
    :to="to"
    class="bm-nav-item"
    :class="{ 'is-active': active }"
  >
    <component
      :is="icon"
      :size="19"
      aria-hidden="true"
    />
    <span>{{ label }}</span>
  </RouterLink>
</template>
