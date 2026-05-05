<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PageHeader from '../../../components/ui/PageHeader.vue'
import SurfaceCard from '../../../components/ui/SurfaceCard.vue'
import { useStatsStore } from '../../../stores/stats'
import type { StatsActivityMetric, StatsRange } from '../../../types/stats'

const { t, locale } = useI18n()
const statsStore = useStatsStore()
const { loading, errorKey, range, activityMetric, summary, filteredSessions, activitySeries, topBooks, goalsProgress } =
  storeToRefs(statsStore)
const weeklyGoalInput = ref(100)
const monthlyGoalInput = ref(600)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))
const maxActivityValue = computed(() =>
  activitySeries.value.reduce((max, point) => Math.max(max, getActivityValue(point)), 0),
)
const totalActivitySessions = computed(() =>
  activitySeries.value.reduce((total, point) => total + point.sessionCount, 0),
)
const activeDays = computed(() => activitySeries.value.filter((point) => point.sessionCount > 0).length)
const averageDailySessions = computed(() => {
  if (activitySeries.value.length === 0) return 0
  return totalActivitySessions.value / activitySeries.value.length
})
const peakActivity = computed(() => {
  if (activitySeries.value.length === 0) return null
  return [...activitySeries.value].sort((a, b) => b.sessionCount - a.sessionCount)[0] ?? null
})

function onChangeRange(nextRange: StatsRange) {
  statsStore.setRange(nextRange)
}

function onChangeMetric(nextMetric: StatsActivityMetric) {
  statsStore.setActivityMetric(nextMetric)
}

function getActivityValue(point: { sessionCount: number; pagesRead: number; minutesRead: number }): number {
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

function formatDayLabel(dayStart: number): string {
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(new Date(dayStart))
}

function formatDayTitle(dayStart: number): string {
  return new Intl.DateTimeFormat(locale.value, { month: 'short', day: 'numeric' }).format(new Date(dayStart))
}

function formatDecimal(value: number): string {
  return value.toFixed(1)
}

function isToday(dayStart: number): boolean {
  const today = new Date()
  const target = new Date(dayStart)
  return (
    target.getDate() === today.getDate() &&
    target.getMonth() === today.getMonth() &&
    target.getFullYear() === today.getFullYear()
  )
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
    const bookTitle = topBooks.value.find((entry) => entry.bookId === session.bookId)?.title ?? 'Unknown'
    return [
      session.startedAtDate.toISOString(),
      bookTitle,
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
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="inline-flex rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1">
        <button
          type="button"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="
            range === '7d'
              ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
          "
          @click="onChangeRange('7d')"
        >
          {{ t('stats.range7d') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="
            range === '30d'
              ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
          "
          @click="onChangeRange('30d')"
        >
          {{ t('stats.range30d') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="
            range === 'all'
              ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
          "
          @click="onChangeRange('all')"
        >
          {{ t('stats.rangeAll') }}
        </button>
      </div>
    </div>

    <p
      v-if="mappedError"
      class="mt-4 rounded-lg border border-[var(--app-danger)] bg-[var(--app-danger-soft)] p-2 text-xs text-[var(--app-danger)]"
    >
      {{ mappedError }}
    </p>

    <p
      v-if="loading"
      class="bm-muted mt-4 text-sm"
    >
      {{ t('stats.loading') }}
    </p>

    <div
      v-else
      class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.totalSessions') }}
        </p>
        <p class="bm-stat-value mt-1">
          {{ summary.totalSessions }}
        </p>
      </article>
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.totalPages') }}
        </p>
        <p class="bm-stat-value mt-1">
          {{ summary.totalPages }}
        </p>
      </article>
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.totalMinutes') }}
        </p>
        <p class="bm-stat-value mt-1">
          {{ summary.totalMinutes }}
        </p>
      </article>
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.currentStreak') }}
        </p>
        <p class="bm-stat-value mt-1">
          {{ summary.currentStreakDays }}
        </p>
      </article>
    </div>

    <div
      v-if="!loading"
      class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
    >
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.bestStreak') }}
        </p>
        <p class="mt-1 text-lg font-semibold text-[var(--app-text)]">
          {{ summary.bestStreakDays }}
        </p>
      </article>
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.sessionsThisWeek') }}
        </p>
        <p class="mt-1 text-lg font-semibold text-[var(--app-text)]">
          {{ summary.sessionsThisWeek }}
        </p>
      </article>
      <article class="bm-stat-card">
        <p class="bm-stat-label">
          {{ t('stats.sessionsThisMonth') }}
        </p>
        <p class="mt-1 text-lg font-semibold text-[var(--app-text)]">
          {{ summary.sessionsThisMonth }}
        </p>
      </article>
    </div>

    <section
      v-if="!loading"
      class="bm-subtle-panel mt-4"
    >
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
              class="h-full rounded bg-[var(--app-success)]"
              :style="{ width: `${goalsProgress.monthlyMinutesProgress}%` }"
            />
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="!loading"
      class="bm-subtle-panel mt-4"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="bm-section-title">
          {{ t('stats.activityTitle') }}
        </p>
        <p class="bm-muted text-xs">
          {{ t('stats.activitySubtitle') }}
        </p>
      </div>

      <div class="mb-3 inline-flex rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-1">
        <button
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
          :class="
            activityMetric === 'sessions'
              ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
          "
          @click="onChangeMetric('sessions')"
        >
          {{ t('stats.metricSessions') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
          :class="
            activityMetric === 'pages'
              ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
          "
          @click="onChangeMetric('pages')"
        >
          {{ t('stats.metricPages') }}
        </button>
        <button
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
          :class="
            activityMetric === 'minutes'
              ? 'bg-[var(--app-accent)] text-[var(--app-accent-contrast)]'
              : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]'
          "
          @click="onChangeMetric('minutes')"
        >
          {{ t('stats.metricMinutes') }}
        </button>
      </div>

      <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <article class="bm-card p-2">
          <p class="bm-stat-label text-[10px]">
            {{ t('stats.avgDailySessions') }}
          </p>
          <p class="mt-1 text-sm font-semibold text-[var(--app-accent-strong)]">
            {{ formatDecimal(averageDailySessions) }}
          </p>
        </article>
        <article class="bm-card p-2">
          <p class="bm-stat-label text-[10px]">
            {{ t('stats.activeDays') }}
          </p>
          <p class="mt-1 text-sm font-semibold text-[var(--app-text)]">
            {{ activeDays }}
          </p>
        </article>
        <article class="bm-card col-span-2 p-2 sm:col-span-1">
          <p class="bm-stat-label text-[10px]">
            {{ t('stats.peakDay') }}
          </p>
          <p class="mt-1 text-sm font-semibold text-[var(--app-text)]">
            {{
              peakActivity
                ? `${formatDayTitle(peakActivity.dayStart)} · ${peakActivity.sessionCount} ${t('stats.sessionsShort')}`
                : '—'
            }}
          </p>
        </article>
      </div>

      <div class="-mx-1 overflow-x-auto px-1">
        <div class="flex h-48 min-w-max items-end gap-2 border-b border-slate-800/80 pb-2 sm:gap-3">
          <article
            v-for="point in activitySeries"
            :key="point.dayStart"
            class="flex w-8 flex-col items-center gap-1 sm:w-9"
            :title="`${formatDayTitle(point.dayStart)}: ${getActivityValue(point)} ${metricUnitLabel()}`"
          >
            <div class="relative flex h-36 w-full items-end rounded-md border border-slate-800 bg-slate-900/70 p-1">
              <div
                class="w-full rounded-sm transition"
                :class="
                  getActivityValue(point) === 0
                    ? 'bg-slate-700/60'
                    : isToday(point.dayStart)
                      ? 'bg-amber-400'
                      : 'bg-cyan-400/90'
                "
                :style="{ height: barHeight(getActivityValue(point)) }"
              />
            </div>
            <span
              class="text-[10px]"
              :class="isToday(point.dayStart) ? 'text-amber-300' : 'text-slate-400'"
            >
              {{ formatDayLabel(point.dayStart) }}
            </span>
            <span class="text-[10px] font-semibold text-slate-300">{{ getActivityValue(point) }}</span>
          </article>
        </div>
      </div>

      <div class="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
        <span class="inline-flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-cyan-400" />
          {{ t('stats.regularDay') }}
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="h-2 w-2 rounded-full bg-amber-400" />
          {{ t('stats.today') }}
        </span>
      </div>
    </section>

    <section
      v-if="!loading"
      class="bm-subtle-panel mt-4"
    >
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
          <p class="text-sm font-semibold text-[var(--app-text)]">
            {{ entry.title }}
          </p>
          <p class="bm-muted mt-1 text-xs">
            {{ t('stats.totalPages') }}: {{ entry.totalPages }} · {{ t('stats.totalMinutes') }}: {{ entry.totalMinutes }}
          </p>
          <p class="bm-soft text-xs">
            {{ t('stats.bookAvgPages') }}: {{ formatDecimal(entry.avgPagesPerSession) }} ·
            {{ t('stats.bookAvgMinutes') }}: {{ formatDecimal(entry.avgMinutesPerSession) }}
          </p>
        </li>
      </ul>
    </section>

    <p
      v-if="!loading && filteredSessions.length === 0"
      class="bm-muted mt-4 text-sm"
    >
      {{ t('stats.empty') }}
    </p>
    </SurfaceCard>
  </div>
</template>
