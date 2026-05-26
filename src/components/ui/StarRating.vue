<script setup lang="ts">
import { computed, ref } from 'vue'
import { Star } from 'lucide-vue-next'
import type { BookRating } from '../../types/books'

const props = withDefaults(defineProps<{
  modelValue: BookRating | null
  readonly?: boolean
  size?: number
}>(), {
  readonly: false,
  size: 24,
})

const emit = defineEmits<{
  'update:modelValue': [value: BookRating | null]
}>()

const hoverValue = ref<number | null>(null)
const displayValue = computed(() => hoverValue.value ?? props.modelValue ?? 0)
const stars = [1, 2, 3, 4, 5] as const
const interactiveBoxSize = computed(() => Math.max(36, props.size + 12))

function normalizeRating(value: number): BookRating {
  const normalized = Math.max(0, Math.min(5, Math.round(value * 2) / 2))
  return normalized as BookRating
}

function getValueFromPointer(value: number, event?: MouseEvent): BookRating {
  const target = event?.currentTarget as HTMLElement | null | undefined
  const rect = target?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return normalizeRating(value)
  const offsetX = Math.max(0, Math.min(rect.width, event.clientX - rect.left))
  if (value === 1 && offsetX < rect.width / 4) return 0
  return normalizeRating(value - (offsetX < rect.width / 2 ? 0.5 : 0))
}

function getFillPercent(value: number): number {
  const filled = displayValue.value - (value - 1)
  return Math.max(0, Math.min(100, filled * 100))
}

function setHover(value: number | null, event?: MouseEvent) {
  if (props.readonly) return
  hoverValue.value = value === null ? null : getValueFromPointer(value, event)
}

function setValue(value: 1 | 2 | 3 | 4 | 5, event: MouseEvent) {
  if (props.readonly) return
  emit('update:modelValue', getValueFromPointer(value, event))
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
      class="inline-flex items-center justify-center rounded transition"
      :class="readonly ? 'cursor-default' : 'cursor-pointer hover:scale-105'"
      :style="{ width: `${interactiveBoxSize}px`, height: `${interactiveBoxSize}px` }"
      :disabled="readonly"
      @mouseenter="setHover(value, $event)"
      @mousemove="setHover(value, $event)"
      @focus="setHover(value)"
      @blur="setHover(null)"
      @click="setValue(value, $event)"
    >
      <span class="relative inline-flex">
        <Star
          :size="size"
          fill="none"
          class="text-(--app-warning)"
          aria-hidden="true"
        />
        <span
          class="absolute inset-0 overflow-hidden text-(--app-warning)"
          :style="{ width: `${getFillPercent(value)}%` }"
          aria-hidden="true"
        >
          <Star
            :size="size"
            fill="currentColor"
            class="max-w-none"
          />
        </span>
      </span>
      <span class="sr-only">{{ getFillPercent(value) === 50 ? value - 0.5 : value }}</span>
    </button>
  </div>
</template>
