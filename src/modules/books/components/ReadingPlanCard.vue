<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bell, CalendarDays, Pencil, Trash2 } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import StatusBadge from '../../../components/ui/StatusBadge.vue'
import type { LibraryBook, ReadingPlan, ReadingPlanDayRecord } from '../../../types/books'
import { createReadingPlanSnapshot, getReadingPlanInsights } from '../../../utils/readingPlan'

const props = defineProps<{
  book: LibraryBook
  records: ReadingPlanDayRecord[]
  saving: boolean
}>()

const emit = defineEmits<{
  save: [plan: ReadingPlan]
  clear: []
}>()

const { t } = useI18n()
const editMode = ref(false)
const targetDate = ref('')
const dailyPagesGoal = ref('')
const reminderEnabled = ref(false)
const reminderTime = ref('19:00')
const reminderDays = ref<number[]>([1, 2, 3, 4, 5])
const weekDays = [0, 1, 2, 3, 4, 5, 6]

const normalizedPlan = computed(() => props.book.readingPlan)
const insights = computed(() => getReadingPlanInsights(props.book))
const hasPlan = computed(() => normalizedPlan.value !== null)
const recentRecords = computed(() => props.records.slice(0, 7))
const recentMetCount = computed(() => recentRecords.value.filter((record) => record.metGoal).length)
const statusTone = computed(() => {
  if (insights.value.status === 'behind') return 'danger'
  if (insights.value.status === 'ahead' || insights.value.status === 'on_track' || insights.value.status === 'completed') {
    return 'success'
  }
  return 'neutral'
})

function syncFormFromPlan() {
  const plan = normalizedPlan.value
  targetDate.value = plan?.targetDate ?? ''
  dailyPagesGoal.value = plan?.dailyPagesGoal ? String(plan.dailyPagesGoal) : ''
  reminderEnabled.value = plan?.reminderEnabled ?? false
  reminderTime.value = plan?.reminderTime ?? '19:00'
  reminderDays.value = plan?.reminderDays?.length ? [...plan.reminderDays] : [1, 2, 3, 4, 5]
}

function onStartEdit() {
  syncFormFromPlan()
  editMode.value = true
}

function onCancelEdit() {
  syncFormFromPlan()
  editMode.value = false
}

async function onSave() {
  if (
    reminderEnabled.value &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'default' &&
    typeof Notification.requestPermission === 'function'
  ) {
    await Notification.requestPermission()
  }
  const parsedGoal = Number(dailyPagesGoal.value)
  const dailyGoal = Number.isFinite(parsedGoal) && parsedGoal > 0 ? Math.floor(parsedGoal) : null
  const plan = createReadingPlanSnapshot(props.book, {
    targetDate: targetDate.value || null,
    dailyPagesGoal: dailyGoal,
    reminderEnabled: reminderEnabled.value,
    reminderTime: reminderEnabled.value ? reminderTime.value || '19:00' : null,
    reminderDays: reminderEnabled.value ? reminderDays.value : null,
  })
  emit('save', plan)
  editMode.value = false
}

function onClear() {
  emit('clear')
  editMode.value = false
}

function formatNullable(value: number | string | null): string {
  return value === null ? t('books.planUnknown') : String(value)
}

watch(() => props.book.readingPlan, syncFormFromPlan, { immediate: true })
</script>

<template>
  <div class="bm-subtle-panel mt-4">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div>
        <p class="bm-eyebrow">{{ t('books.planTitle') }}</p>
        <p class="bm-muted mt-1 text-xs">{{ t('books.planSubtitle') }}</p>
      </div>
      <button
        v-if="!editMode"
        type="button"
        class="bm-icon-button"
        :aria-label="t('books.editPlan')"
        :title="t('books.editPlan')"
        @click="onStartEdit"
      >
        <Pencil
          :size="16"
          aria-hidden="true"
        />
      </button>
    </div>

    <template v-if="!editMode">
      <div
        v-if="hasPlan"
        class="space-y-3"
      >
        <div class="flex flex-wrap items-center gap-2">
          <StatusBadge :tone="statusTone">
            {{ t(`books.planStatus_${insights.status}`) }}
          </StatusBadge>
          <span
            v-if="insights.inconsistentPlan"
            class="rounded-full border border-(--app-warning) bg-(--app-warning-soft) px-2 py-1 text-[11px] font-bold text-(--app-warning)"
          >
            {{ t('books.planInconsistentShort') }}
          </span>
        </div>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <article class="bm-card p-2">
            <p class="bm-stat-label text-[10px]">{{ t('books.planRemainingPages') }}</p>
            <p class="mt-1 text-sm font-semibold text-(--app-text)">{{ formatNullable(insights.remainingPages) }}</p>
          </article>
          <article class="bm-card p-2">
            <p class="bm-stat-label text-[10px]">{{ t('books.planRequiredDaily') }}</p>
            <p class="mt-1 text-sm font-semibold text-(--app-text)">{{ formatNullable(insights.requiredDailyPages) }}</p>
          </article>
          <article class="bm-card p-2">
            <p class="bm-stat-label text-[10px]">{{ t('books.planProjectedFinish') }}</p>
            <p class="mt-1 text-sm font-semibold text-(--app-text)">{{ formatNullable(insights.projectedFinishDate) }}</p>
          </article>
          <article class="bm-card p-2">
            <p class="bm-stat-label text-[10px]">{{ t('books.planDeltaToday') }}</p>
            <p class="mt-1 text-sm font-semibold text-(--app-text)">{{ formatNullable(insights.deltaPagesToday) }}</p>
          </article>
        </div>
        <p
          v-if="insights.inconsistentPlan"
          class="text-xs text-(--app-warning)"
        >
          {{ t('books.planInconsistent') }}
        </p>
        <p class="bm-soft flex items-center gap-1 text-xs">
          <Bell
            :size="14"
            aria-hidden="true"
          />
          {{
            normalizedPlan?.reminderEnabled
              ? t('books.planReminderOn', { time: normalizedPlan.reminderTime ?? '19:00' })
              : t('books.planReminderOff')
          }}
        </p>
        <div
          v-if="recentRecords.length > 0"
          class="rounded-lg border border-(--app-border) bg-(--app-surface) p-3"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="bm-stat-label text-[10px]">{{ t('books.planLastSevenDays') }}</p>
            <p class="text-xs font-semibold text-(--app-text)">
              {{ recentMetCount }} / {{ recentRecords.length }}
            </p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="record in recentRecords"
              :key="record.id"
              class="inline-flex min-w-9 flex-col items-center rounded-lg border px-2 py-1 text-[10px] font-bold"
              :class="
                record.metGoal
                  ? 'border-(--app-success) bg-(--app-success-soft) text-(--app-success)'
                  : 'border-(--app-danger) bg-(--app-danger-soft) text-(--app-danger)'
              "
              :title="`${record.dayId}: ${record.actualPages}/${record.targetPages}`"
            >
              <span>{{ record.dayId.slice(5) }}</span>
              <span>{{ record.actualPages }}/{{ record.targetPages }}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-else
        class="rounded-lg border border-dashed border-(--app-border) p-3"
      >
        <p class="bm-muted text-sm">{{ t('books.planEmpty') }}</p>
        <button
          type="button"
          class="bm-button bm-button-primary mt-3 text-xs"
          @click="onStartEdit"
        >
          <CalendarDays
            :size="15"
            aria-hidden="true"
          />
          {{ t('books.createPlan') }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label class="bm-label">
          {{ t('books.planTargetDate') }}
          <input
            v-model="targetDate"
            type="date"
            class="bm-input mt-1 py-1.5 text-sm"
            :disabled="saving"
          >
        </label>
        <label class="bm-label">
          {{ t('books.planDailyPages') }}
          <input
            v-model="dailyPagesGoal"
            type="number"
            min="1"
            class="bm-input mt-1 py-1.5 text-sm"
            :disabled="saving"
            :placeholder="t('books.planDailyPagesPlaceholder')"
          >
        </label>
      </div>

      <label class="mt-3 flex cursor-pointer items-center gap-2 text-sm text-(--app-text)">
        <input
          v-model="reminderEnabled"
          type="checkbox"
          class="h-4 w-4 rounded border-(--app-border) text-(--app-primary) accent-(--app-primary)"
          :disabled="saving"
        >
        {{ t('books.planReminderEnabled') }}
      </label>

      <div
        v-if="reminderEnabled"
        class="mt-3 grid grid-cols-1 gap-2"
      >
        <label class="bm-label">
          {{ t('books.planReminderTime') }}
          <input
            v-model="reminderTime"
            type="time"
            class="bm-input mt-1 py-1.5 text-sm"
            :disabled="saving"
          >
        </label>
        <fieldset class="grid gap-2">
          <legend class="bm-label">{{ t('books.planReminderDays') }}</legend>
          <div class="flex flex-wrap gap-2">
            <label
              v-for="day in weekDays"
              :key="day"
              class="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-(--app-border) px-2 py-1 text-xs text-(--app-text)"
            >
              <input
                v-model="reminderDays"
                type="checkbox"
                :value="day"
                :disabled="saving"
                class="accent-(--app-primary)"
              >
              {{ t(`books.planDay_${day}`) }}
            </label>
          </div>
        </fieldset>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="bm-button bm-button-primary text-xs"
          :disabled="saving || (!targetDate && !dailyPagesGoal && !reminderEnabled)"
          @click="onSave"
        >
          {{ saving ? t('books.savingMetadata') : t('books.savePlan') }}
        </button>
        <button
          type="button"
          class="bm-button text-xs"
          :disabled="saving"
          @click="onCancelEdit"
        >
          {{ t('books.cancelEdit') }}
        </button>
        <button
          v-if="hasPlan"
          type="button"
          class="bm-button bm-button-danger text-xs"
          :disabled="saving"
          @click="onClear"
        >
          <Trash2
            :size="14"
            aria-hidden="true"
          />
          {{ t('books.clearPlan') }}
        </button>
      </div>
    </template>
  </div>
</template>
