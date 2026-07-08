<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
import { useStatsStore } from '../../../stores/stats'
import type { StatsActivityMetric, StatsActivityPoint, StatsRange } from '../../../types/stats'

const { t, locale } = useI18n()
const statsStore = useStatsStore()
const {
  loading,
  errorKey,
  range,
  activityMetric,
  summary,
  filteredSessions,
  activitySeries,
  topBooks,
  goalsProgress,
  readingPlanSummary,
  selectedTimelineYear,
  timelineYears,
  timelineMonthlyBySelectedYear,
  selectedYearSummary,
} = storeToRefs(statsStore)
const weeklyGoalInput = ref(100)
const monthlyGoalInput = ref(600)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))
const maxActivityValue = computed(() =>
  activitySeries.value.reduce((max, point) => Math.max(max, getActivityValue(point)), 0),
)
const averageActivity = computed(() => {
  if (activitySeries.value.length === 0) return 0
  const total = activitySeries.value.reduce((sum, point) => sum + getActivityValue(point), 0)
  return total / activitySeries.value.length
})
const peakActivity = computed(() => {
  if (activitySeries.value.length === 0) return null
  return [...activitySeries.value].sort((a, b) => getActivityValue(b) - getActivityValue(a))[0] ?? null
})
const activitySubtitle = computed(() =>
  range.value === 'all'
    ? t('stats.activityMonthlySubtitle')
    : range.value === '30d'
      ? t('stats.activityWeeklySubtitle')
      : t('stats.activityDailySubtitle'),
)
const activityAverageLabel = computed(() =>
  range.value === 'all'
    ? t('stats.avgMonthlyActivity')
    : range.value === '30d'
      ? t('stats.avgWeeklyActivity')
      : t('stats.avgDailyActivity'),
)
const activityGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(1, activitySeries.value.length)}, minmax(0, 1fr))`,
}))
const activityLabelStep = computed(() => {
  const points = activitySeries.value.length
  if (points <= 12) return 1
  if (points <= 24) return 2
  return Math.ceil(points / 12)
})
const maxTimelineMonthValue = computed(() =>
  timelineMonthlyBySelectedYear.value.reduce((max, entry) => Math.max(max, entry.finishedCount), 0),
)

const statCards = computed(() => [
  { label: t('stats.totalSessions'), value: summary.value.totalSessions },
  { label: t('stats.totalPages'), value: summary.value.totalPages },
  { label: t('stats.totalMinutes'), value: summary.value.totalMinutes },
  { label: t('stats.activeDays'), value: summary.value.activeDays },
])

function onChangeRange(nextRange: StatsRange) {
  statsStore.setRange(nextRange)
}

function onChangeMetric(nextMetric: StatsActivityMetric) {
  statsStore.setActivityMetric(nextMetric)
}

function onChangeTimelineYear(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (Number.isNaN(value)) return
  statsStore.setSelectedTimelineYear(value)
}

function getActivityValue(point: StatsActivityPoint): number {
  if (activityMetric.value === 'pages') return point.pagesRead
  if (activityMetric.value === 'minutes') return point.minutesRead
  return point.sessionCount
}

function metricUnitLabel(): string {
  if (activityMetric.value === 'pages') return t('stats.pagesShort')
  if (activityMetric.value === 'minutes') return t('stats.minutesShort')
  return t('stats.sessionsShort')
}

function barHeight(value: number): string {
  const max = maxActivityValue.value
  if (max <= 0) return '8%'
  return `${Math.max(8, Math.round((value / max) * 100))}%`
}

function formatActivityLabel(point: StatsActivityPoint): string {
  const date = new Date(point.periodStart)
  if (point.granularity === 'month') {
    return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(date)
  }
  if (point.granularity === 'week') {
    return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(date)
}

function formatActivityTitle(point: StatsActivityPoint): string {
  const date = new Date(point.periodStart)
  if (point.granularity === 'month') {
    return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(date)
  }
  if (point.granularity === 'week') {
    const end = new Date(point.periodStart + 6 * 86400000)
    const startLabel = new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(date)
    const endLabel = new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(end)
    return `${startLabel} - ${endLabel}`
  }
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(date)
}

function formatDecimal(value: number): string {
  return value.toFixed(1)
}

function formatMonthLabel(month: number): string {
  const date = new Date(2020, month - 1, 1)
  return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(date)
}

function timelineBarHeight(value: number): string {
  const max = maxTimelineMonthValue.value
  if (max <= 0) return '8%'
  return `${Math.max(8, Math.round((value / max) * 100))}%`
}

function isCurrentPeriod(point: StatsActivityPoint): boolean {
  const today = new Date()
  const target = new Date(point.periodStart)
  if (point.granularity === 'month') {
    return target.getMonth() === today.getMonth() && target.getFullYear() === today.getFullYear()
  }
  if (point.granularity === 'week') {
    return target.getTime() === startOfWeek(today).getTime()
  }
  return (
    target.getDate() === today.getDate() &&
    target.getMonth() === today.getMonth() &&
    target.getFullYear() === today.getFullYear()
  )
}

function startOfWeek(date: Date): Date {
  const target = new Date(date)
  const day = target.getDay()
  const diff = day === 0 ? -6 : 1 - day
  target.setDate(target.getDate() + diff)
  target.setHours(0, 0, 0, 0)
  return target
}

function shouldShowActivityLabel(index: number): boolean {
  return index === 0 || index === activitySeries.value.length - 1 || index % activityLabelStep.value === 0
}

function onUpdateWeeklyGoal() {
  statsStore.setWeeklyPagesGoal(Number(weeklyGoalInput.value))
}

function onUpdateMonthlyGoal() {
  statsStore.setMonthlyMinutesGoal(Number(monthlyGoalInput.value))
}

function formatCsvCell(value: string | number): string {
  const text = String(value).replace(/"/g, '""')
  return `"${text}"`
}

function onExportCsv() {
  const header = ['date', 'book', 'bookId', 'pagesRead', 'minutesRead', 'startPage', 'endPage']
  const rows = filteredSessions.value.map((session) => {
    return [
      session.startedAtDate.toISOString(),
      statsStore.getBookTitle(session.bookId),
      session.bookId,
      Math.max(0, session.pagesRead ?? 0),
      Math.floor(Math.max(0, session.durationSeconds ?? 0) / 60),
      Math.max(0, session.startPage ?? 0),
      Math.max(0, session.endPage ?? 0),
    ]
  })
  const csv = [header, ...rows].map((line) => line.map((cell) => formatCsvCell(cell)).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `bookmemory-sessions-${range.value}-${date}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await statsStore.loadStats()
  weeklyGoalInput.value = goalsProgress.value.weeklyPagesGoal
  monthlyGoalInput.value = goalsProgress.value.monthlyMinutesGoal
})
</script>

<template>
  <div class="bm-page">
    <PageHeader
      :eyebrow="t('modules.statsLabel')"
      :title="t('stats.title')"
      :subtitle="t('stats.subtitle')"
    >
      <template #actions>
        <button
          type="button"
          class="bm-button"
          :disabled="filteredSessions.length === 0"
          @click="onExportCsv"
        >
          {{ t('stats.exportCsv') }}
        </button>
      </template>
    </PageHeader>

    <SurfaceCard>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="inline-flex rounded-xl border border-(--app-border) bg-(--app-surface-muted) p-1">
          <button
            v-for="option in (['7d', '30d', 'all'] as StatsRange[])"
            :key="option"
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            :class="
              range === option
                ? 'bg-(--app-primary) text-(--app-primary-contrast)'
                : 'text-(--app-text-muted) hover:bg-(--app-surface)'
            "
            @click="onChangeRange(option)"
          >
            {{ t(`stats.range_${option}`) }}
          </button>
        </div>
        <p class="bm-muted text-xs">
          {{ t('stats.rangeHint') }}
        </p>
      </div>

      <p
        v-if="mappedError"
        class="mt-4 rounded-lg border border-(--app-danger) bg-(--app-danger-soft) p-2 text-xs text-(--app-danger)"
      >
        {{ mappedError }}
      </p>

      <p
        v-if="loading"
        class="bm-muted mt-4 text-sm"
      >
        {{ t('stats.loading') }}
      </p>

      <template v-else>
        <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <article
            v-for="card in statCards"
            :key="card.label"
            class="bm-stat-card"
          >
            <p class="bm-stat-label">
              {{ card.label }}
            </p>
            <p class="bm-stat-value mt-1">
              {{ card.value }}
            </p>
          </article>
        </div>

        <section class="bm-subtle-panel mt-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="bm-section-title">
                {{ t('stats.activityTitle') }}
              </p>
              <p class="bm-muted mt-1 text-xs">
                {{ activitySubtitle }}
              </p>
            </div>

            <div class="inline-flex rounded-lg border border-(--app-border) bg-(--app-surface-muted) p-1">
              <button
                v-for="metric in (['sessions', 'pages', 'minutes'] as StatsActivityMetric[])"
                :key="metric"
                type="button"
                class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
                :class="
                  activityMetric === metric
                    ? 'bg-(--app-primary) text-(--app-primary-contrast)'
                    : 'text-(--app-text-muted) hover:bg-(--app-surface)'
                "
                @click="onChangeMetric(metric)"
              >
                {{ t(`stats.metric_${metric}`) }}
              </button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <article class="bm-card p-2">
              <p class="bm-stat-label text-[10px]">
                {{ activityAverageLabel }}
              </p>
              <p class="mt-1 text-sm font-semibold text-(--app-primary-strong)">
                {{ formatDecimal(averageActivity) }}
              </p>
            </article>
            <article class="bm-card p-2">
              <p class="bm-stat-label text-[10px]">
                {{ t('stats.currentStreak') }}
              </p>
              <p class="mt-1 text-sm font-semibold text-(--app-text)">
                {{ summary.currentStreakDays }}
              </p>
            </article>
            <article class="bm-card col-span-2 p-2 sm:col-span-1">
              <p class="bm-stat-label text-[10px]">
                {{ t('stats.peakPeriod') }}
              </p>
              <p class="mt-1 text-sm font-semibold text-(--app-text)">
                {{
                  peakActivity
                    ? `${formatActivityTitle(peakActivity)} · ${getActivityValue(peakActivity)} ${metricUnitLabel()}`
                    : '-'
                }}
              </p>
            </article>
          </div>

          <div class="mt-3 min-w-0">
            <div
              class="grid h-44 items-end gap-1 border-b border-(--app-border) pb-2 sm:gap-2"
              :style="activityGridStyle"
            >
              <article
                v-for="(point, index) in activitySeries"
                :key="point.periodKey"
                class="flex min-w-0 flex-col items-center gap-1"
                :title="`${formatActivityTitle(point)}: ${getActivityValue(point)} ${metricUnitLabel()}`"
              >
                <div class="relative flex h-32 w-full min-w-[5px] items-end rounded-md border border-(--app-border) bg-(--app-surface) p-0.5 sm:p-1">
                  <div
                    class="w-full rounded-sm transition"
                    :class="
                      getActivityValue(point) === 0
                        ? 'bg-(--app-surface-muted)'
                        : isCurrentPeriod(point)
                          ? 'bg-(--app-secondary)'
                          : 'bg-(--app-accent)'
                    "
                    :style="{ height: barHeight(getActivityValue(point)) }"
                  />
                </div>
                <span
                  class="min-h-3 max-w-full truncate text-[9px] sm:text-[10px]"
                  :class="isCurrentPeriod(point) ? 'text-(--app-secondary-strong)' : 'text-(--app-text-muted)'"
                >
                  {{ shouldShowActivityLabel(index) ? formatActivityLabel(point) : '' }}
                </span>
              </article>
            </div>
          </div>
        </section>

        <section class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div class="bm-subtle-panel">
            <p class="bm-section-title">
              {{ t('stats.topBooksTitle') }}
            </p>
            <p
              v-if="topBooks.length === 0"
              class="bm-muted mt-2 text-sm"
            >
              {{ t('stats.topBooksEmpty') }}
            </p>
            <ul
              v-else
              class="mt-2 space-y-2"
            >
              <li
                v-for="entry in topBooks"
                :key="entry.bookId"
                class="bm-card"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-(--app-text)">
                      {{ entry.title }}
                    </p>
                    <p class="bm-muted mt-1 text-xs">
                      {{ entry.sessionCount }} {{ t('stats.sessionsShort') }} ·
                      {{ entry.totalPages }} {{ t('stats.pagesShort') }} ·
                      {{ entry.totalMinutes }} {{ t('stats.minutesShort') }}
                    </p>
                  </div>
                  <p class="text-sm font-semibold text-(--app-primary-strong)">
                    {{ formatDecimal(entry.avgPagesPerSession) }}
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div class="bm-subtle-panel">
            <p class="bm-section-title">
              {{ t('stats.rhythmTitle') }}
            </p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <article class="bm-card p-2">
                <p class="bm-stat-label text-[10px]">
                  {{ t('stats.bestStreak') }}
                </p>
                <p class="mt-1 text-sm font-semibold text-(--app-text)">
                  {{ summary.bestStreakDays }}
                </p>
              </article>
              <article class="bm-card p-2">
                <p class="bm-stat-label text-[10px]">
                  {{ t('stats.planAdherence') }}
                </p>
                <p class="mt-1 text-sm font-semibold text-(--app-text)">
                  {{ readingPlanSummary.adherencePercent }}%
                </p>
              </article>
              <article class="bm-card p-2">
                <p class="bm-stat-label text-[10px]">
                  {{ t('stats.planMetDays') }}
                </p>
                <p class="mt-1 text-sm font-semibold text-(--app-success)">
                  {{ readingPlanSummary.metDays }} / {{ readingPlanSummary.totalDays }}
                </p>
              </article>
              <article class="bm-card p-2">
                <p class="bm-stat-label text-[10px]">
                  {{ t('stats.planAtRiskBooks') }}
                </p>
                <p class="mt-1 text-sm font-semibold text-(--app-danger)">
                  {{ readingPlanSummary.atRiskBooks }}
                </p>
              </article>
            </div>
          </div>
        </section>

        <section class="bm-subtle-panel mt-4">
          <p class="bm-section-title">
            {{ t('stats.goalsTitle') }}
          </p>
          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <article class="bm-card">
              <label class="bm-label">
                {{ t('stats.weeklyPagesGoal') }}
                <input
                  v-model.number="weeklyGoalInput"
                  type="number"
                  min="1"
                  class="bm-input mt-1 py-1 text-sm"
                  @change="onUpdateWeeklyGoal"
                >
              </label>
              <p class="bm-muted mt-2 text-xs">
                {{ summary.pagesThisWeek }} / {{ goalsProgress.weeklyPagesGoal }} {{ t('stats.pagesShort') }}
              </p>
              <div class="bm-progress-track mt-1">
                <div
                  class="bm-progress-fill"
                  :style="{ width: `${goalsProgress.weeklyPagesProgress}%` }"
                />
              </div>
            </article>

            <article class="bm-card">
              <label class="bm-label">
                {{ t('stats.monthlyMinutesGoal') }}
                <input
                  v-model.number="monthlyGoalInput"
                  type="number"
                  min="1"
                  class="bm-input mt-1 py-1 text-sm"
                  @change="onUpdateMonthlyGoal"
                >
              </label>
              <p class="bm-muted mt-2 text-xs">
                {{ summary.minutesThisMonth }} / {{ goalsProgress.monthlyMinutesGoal }} {{ t('stats.minutesShort') }}
              </p>
              <div class="bm-progress-track mt-1">
                <div
                  class="h-full rounded bg-(--app-accent)"
                  :style="{ width: `${goalsProgress.monthlyMinutesProgress}%` }"
                />
              </div>
            </article>
          </div>
        </section>

        <section class="bm-subtle-panel mt-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="bm-section-title">
              {{ t('stats.timelineTitle') }}
            </p>
            <label class="bm-label text-xs">
              {{ t('stats.timelineYearLabel') }}
              <select
                class="bm-input mt-1 py-1 text-xs"
                :value="selectedTimelineYear ?? ''"
                :disabled="timelineYears.length === 0"
                @change="onChangeTimelineYear"
              >
                <option
                  v-for="year in timelineYears"
                  :key="year"
                  :value="year"
                >
                  {{ year }}
                </option>
              </select>
            </label>
          </div>

          <p
            v-if="timelineMonthlyBySelectedYear.length === 0"
            class="bm-muted text-sm"
          >
            {{ t('stats.timelineEmpty') }}
          </p>

          <template v-else>
            <p
              v-if="selectedYearSummary"
              class="bm-muted mb-3 text-xs"
            >
              {{ t('stats.timelineFinishedYear') }}: {{ selectedYearSummary.finishedCount }}
            </p>

            <div class="-mx-1 overflow-x-auto px-1">
              <div class="flex h-36 min-w-max items-end gap-3 border-b border-(--app-border) pb-2">
                <article
                  v-for="point in timelineMonthlyBySelectedYear"
                  :key="point.monthKey"
                  class="flex w-10 flex-col items-center gap-1"
                >
                  <div class="flex h-24 w-full items-end rounded-md border border-(--app-border) bg-(--app-surface) p-1">
                    <div
                      class="w-full rounded-sm bg-(--app-secondary)"
                      :title="`${t('stats.timelineFinished')}: ${point.finishedCount}`"
                      :style="{ height: timelineBarHeight(point.finishedCount) }"
                    />
                  </div>
                  <span class="text-[10px] text-(--app-text-muted)">
                    {{ formatMonthLabel(point.month) }}
                  </span>
                </article>
              </div>
            </div>
          </template>
        </section>

        <p
          v-if="filteredSessions.length === 0"
          class="bm-muted mt-4 text-sm"
        >
          {{ t('stats.empty') }}
        </p>
      </template>
    </SurfaceCard>
  </div>
</template>
