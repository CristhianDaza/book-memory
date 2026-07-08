<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BookmarkPlus } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { BookMemoryKind, CreateBookMemoryInput } from '../../../types/memories'

const props = withDefaults(
  defineProps<{
    bookId: string
    defaultPage?: number | null
    saving?: boolean
    compact?: boolean
  }>(),
  {
    defaultPage: null,
    saving: false,
    compact: false,
  },
)

const emit = defineEmits<{
  save: [payload: CreateBookMemoryInput]
}>()

const { t } = useI18n()
const kind = ref<BookMemoryKind>('idea')
const content = ref('')
const page = ref('')
const tags = ref('')
const favorite = ref(false)

const canSave = computed(() => Boolean(props.bookId && content.value.trim() && !props.saving))

watch(
  () => props.defaultPage,
  (nextPage) => {
    page.value = nextPage === null || nextPage === undefined ? '' : String(nextPage)
  },
  { immediate: true },
)

function onSubmit() {
  if (!canSave.value) return
  const parsedPage = page.value.trim() === '' ? null : Number(page.value)
  emit('save', {
    bookId: props.bookId,
    kind: kind.value,
    content: content.value,
    page: Number.isFinite(parsedPage) && parsedPage !== null ? Math.max(0, Math.floor(parsedPage)) : null,
    tags: tags.value.split(','),
    favorite: favorite.value,
  })
  content.value = ''
  tags.value = ''
  favorite.value = false
}
</script>

<template>
  <form
    class="bm-subtle-panel"
    :class="compact ? 'p-3' : ''"
    @submit.prevent="onSubmit"
  >
    <div class="mb-3 flex items-center justify-between gap-2">
      <div>
        <p class="bm-section-title">{{ t('memories.quickAddTitle') }}</p>
        <p
          v-if="!compact"
          class="bm-muted text-xs"
        >
          {{ t('memories.quickAddSubtitle') }}
        </p>
      </div>
      <BookmarkPlus
        :size="18"
        class="text-(--app-primary-strong)"
        aria-hidden="true"
      />
    </div>

    <div class="grid grid-cols-1 gap-2 sm:grid-cols-[9rem_7rem_minmax(0,1fr)]">
      <label class="bm-label">
        {{ t('memories.kindLabel') }}
        <select
          v-model="kind"
          class="bm-select mt-1 py-1.5 text-sm"
        >
          <option value="quote">{{ t('memories.kind_quote') }}</option>
          <option value="idea">{{ t('memories.kind_idea') }}</option>
          <option value="question">{{ t('memories.kind_question') }}</option>
          <option value="summary">{{ t('memories.kind_summary') }}</option>
        </select>
      </label>

      <label class="bm-label">
        {{ t('memories.pageLabel') }}
        <input
          v-model="page"
          type="number"
          min="0"
          class="bm-input mt-1 py-1.5 text-sm"
        >
      </label>

      <label class="bm-label">
        {{ t('memories.tagsLabel') }}
        <input
          v-model="tags"
          type="text"
          :placeholder="t('memories.tagsPlaceholder')"
          class="bm-input mt-1 py-1.5 text-sm"
        >
      </label>
    </div>

    <label class="bm-label mt-2 block">
      {{ t('memories.contentLabel') }}
      <textarea
        v-model="content"
        :placeholder="t('memories.contentPlaceholder')"
        class="bm-input mt-1 min-h-24 text-sm"
      />
    </label>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
      <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold text-(--app-text-muted)">
        <input
          v-model="favorite"
          type="checkbox"
          class="h-4 w-4 rounded border-(--app-border) accent-(--app-primary)"
        >
        {{ t('memories.favoriteLabel') }}
      </label>

      <button
        type="submit"
        class="bm-button bm-button-primary"
        :disabled="!canSave"
      >
        <BookmarkPlus
          :size="16"
          aria-hidden="true"
        />
        {{ saving ? t('memories.saving') : t('memories.saveAction') }}
      </button>
    </div>
  </form>
</template>

