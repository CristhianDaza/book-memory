<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">
      {{ t('modules.statsLabel') }}
    </p>
    <h1 class="mt-2 text-2xl font-semibold text-white">
      {{ t('stats.title') }}
    </h1>
    <p class="mt-3 text-sm text-slate-300">
      {{ t('stats.subtitle') }}
    </p>

    <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
      <div class="inline-flex rounded-xl border border-slate-800 bg-slate-950/60 p-1">
        <button
          type="button"
          class="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="
            range === '7d'
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
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
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
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
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          "
          @click="onChangeRange('all')"
        >
          {{ t('stats.rangeAll') }}
        </button>
      </div>

      <button
        type="button"
        class="cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-slate-800"
        :disabled="filteredSessions.length === 0"
        @click="onExportCsv"
      >
        {{ t('stats.exportCsv') }}
      </button>
    </div>

    <p
      v-if="mappedError"
      class="mt-4 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200"
    >
      {{ mappedError }}
    </p>

    <p
      v-if="loading"
      class="mt-4 text-sm text-slate-400"
    >
      {{ t('stats.loading') }}
    </p>

    <div
      v-else
      class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.totalSessions') }}
        </p>
        <p class="mt-1 text-xl font-semibold text-white">
          {{ summary.totalSessions }}
        </p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.totalPages') }}
        </p>
        <p class="mt-1 text-xl font-semibold text-white">
          {{ summary.totalPages }}
        </p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.totalMinutes') }}
        </p>
        <p class="mt-1 text-xl font-semibold text-white">
          {{ summary.totalMinutes }}
        </p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.currentStreak') }}
        </p>
        <p class="mt-1 text-xl font-semibold text-white">
          {{ summary.currentStreakDays }}
        </p>
      </article>
    </div>

    <div
      v-if="!loading"
      class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
    >
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.bestStreak') }}
        </p>
        <p class="mt-1 text-lg font-semibold text-white">
          {{ summary.bestStreakDays }}
        </p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.sessionsThisWeek') }}
        </p>
        <p class="mt-1 text-lg font-semibold text-white">
          {{ summary.sessionsThisWeek }}
        </p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">
          {{ t('stats.sessionsThisMonth') }}
        </p>
        <p class="mt-1 text-lg font-semibold text-white">
          {{ summary.sessionsThisMonth }}
        </p>
      </article>
    </div>

    <section
      v-if="!loading"
      class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
    >
      <p class="text-sm font-semibold text-white">
        {{ t('stats.goalsTitle') }}
      </p>
      <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <label class="text-[11px] uppercase tracking-wide text-slate-400">
            {{ t('stats.weeklyPagesGoal') }}
            <input
              v-model.number="weeklyGoalInput"
              type="number"
              min="1"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              @change="onUpdateWeeklyGoal"
            >
          </label>
          <p class="mt-2 text-xs text-slate-300">
            {{ summary.pagesThisWeek }} / {{ goalsProgress.weeklyPagesGoal }} {{ t('stats.pagesShort') }}
          </p>
          <div class="mt-1 h-2 rounded bg-slate-800">
            <div
              class="h-full rounded bg-cyan-400"
              :style="{ width: `${goalsProgress.weeklyPagesProgress}%` }"
            />
          </div>
        </article>

        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
          <label class="text-[11px] uppercase tracking-wide text-slate-400">
            {{ t('stats.monthlyMinutesGoal') }}
            <input
              v-model.number="monthlyGoalInput"
              type="number"
              min="1"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              @change="onUpdateMonthlyGoal"
            >
          </label>
          <p class="mt-2 text-xs text-slate-300">
            {{ summary.minutesThisMonth }} / {{ goalsProgress.monthlyMinutesGoal }} {{ t('stats.minutesShort') }}
          </p>
          <div class="mt-1 h-2 rounded bg-slate-800">
            <div
              class="h-full rounded bg-emerald-400"
              :style="{ width: `${goalsProgress.monthlyMinutesProgress}%` }"
            />
          </div>
        </article>
      </div>
    </section>

    <section
      v-if="!loading"
      class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="text-sm font-semibold text-white">
          {{ t('stats.activityTitle') }}
        </p>
        <p class="text-xs text-slate-400">
          {{ t('stats.activitySubtitle') }}
        </p>
      </div>

      <div class="mb-3 inline-flex rounded-lg border border-slate-800 bg-slate-900/70 p-1">
        <button
          type="button"
          class="cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
          :class="
            activityMetric === 'sessions'
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
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
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
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
              ? 'bg-cyan-500 text-slate-950'
              : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
          "
          @click="onChangeMetric('minutes')"
        >
          {{ t('stats.metricMinutes') }}
        </button>
      </div>

      <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
          <p class="text-[10px] uppercase tracking-wide text-slate-400">
            {{ t('stats.avgDailySessions') }}
          </p>
          <p class="mt-1 text-sm font-semibold text-cyan-300">
            {{ formatDecimal(averageDailySessions) }}
          </p>
        </article>
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
          <p class="text-[10px] uppercase tracking-wide text-slate-400">
            {{ t('stats.activeDays') }}
          </p>
          <p class="mt-1 text-sm font-semibold text-white">
            {{ activeDays }}
          </p>
        </article>
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-2 col-span-2 sm:col-span-1">
          <p class="text-[10px] uppercase tracking-wide text-slate-400">
            {{ t('stats.peakDay') }}
          </p>
          <p class="mt-1 text-sm font-semibold text-white">
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
      class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
    >
      <p class="text-sm font-semibold text-white">
        {{ t('stats.topBooksTitle') }}
      </p>
      <p
        v-if="topBooks.length === 0"
        class="mt-2 text-sm text-slate-400"
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
          class="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
        >
          <p class="text-sm font-semibold text-white">
            {{ entry.title }}
          </p>
          <p class="mt-1 text-xs text-slate-300">
            {{ t('stats.totalPages') }}: {{ entry.totalPages }} · {{ t('stats.totalMinutes') }}: {{ entry.totalMinutes }}
          </p>
          <p class="text-xs text-slate-400">
            {{ t('stats.bookAvgPages') }}: {{ formatDecimal(entry.avgPagesPerSession) }} ·
            {{ t('stats.bookAvgMinutes') }}: {{ formatDecimal(entry.avgMinutesPerSession) }}
          </p>
        </li>
      </ul>
    </section>

    <p
      v-if="!loading && filteredSessions.length === 0"
      class="mt-4 text-sm text-slate-400"
    >
      {{ t('stats.empty') }}
    </p>
  </section>
</template>
