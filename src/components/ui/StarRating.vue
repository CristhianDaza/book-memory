<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: 1 | 2 | 3 | 4 | 5 | null
  readonly?: boolean
  size?: number
}>(), {
  readonly: false,
  size: 18,
})

const emit = defineEmits<{
  'update:modelValue': [value: 1 | 2 | 3 | 4 | 5 | null]
}>()

const hoverValue = ref<number | null>(null)
const displayValue = computed(() => hoverValue.value ?? props.modelValue ?? 0)
const stars = [1, 2, 3, 4, 5] as const

function setHover(value: number | null) {
  if (props.readonly) return
  hoverValue.value = value
}

function setValue(value: 1 | 2 | 3 | 4 | 5) {
  if (props.readonly) return
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="inline-flex items-center gap-1"
    @mouseleave="setHover(null)"
  >
    <button
      v-for="value in stars"
      :key="value"
      type="button"
      class="inline-flex h-6 w-6 items-center justify-center rounded transition"
      :class="readonly ? 'cursor-default' : 'cursor-pointer hover:scale-105'"
      :disabled="readonly"
      @mouseenter="setHover(value)"
      @focus="setHover(value)"
      @blur="setHover(null)"
      @click="setValue(value)"
    >
      <Star
        :size="size"
        :fill="value <= displayValue ? 'currentColor' : 'none'"
        class="text-(--app-warning)"
        aria-hidden="true"
      />
      <span class="sr-only">{{ value }}</span>
    </button>
  </div>
</template>
