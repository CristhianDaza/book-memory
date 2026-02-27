<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStatsStore } from '../../../stores/stats'
import type { StatsRange } from '../../../types/stats'

const { t, locale } = useI18n()
const statsStore = useStatsStore()
const { loading, errorKey, range, summary, filteredSessions, activitySeries } = storeToRefs(statsStore)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))
const maxActivitySessions = computed(() =>
  activitySeries.value.reduce((max, point) => Math.max(max, point.sessionCount), 0),
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

function barHeight(value: number): string {
  const max = maxActivitySessions.value
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

onMounted(async () => {
  await statsStore.loadStats()
})
</script>

<template>
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('modules.statsLabel') }}</p>
    <h1 class="mt-2 text-2xl font-semibold text-white">{{ t('stats.title') }}</h1>
    <p class="mt-3 text-sm text-slate-300">{{ t('stats.subtitle') }}</p>

    <div class="mt-4 inline-flex rounded-xl border border-slate-800 bg-slate-950/60 p-1">
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

    <p v-if="mappedError" class="mt-4 rounded-lg border border-rose-700/50 bg-rose-950/50 p-2 text-xs text-rose-200">
      {{ mappedError }}
    </p>

    <p v-if="loading" class="mt-4 text-sm text-slate-400">{{ t('stats.loading') }}</p>

    <div v-else class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.totalSessions') }}</p>
        <p class="mt-1 text-xl font-semibold text-white">{{ summary.totalSessions }}</p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.totalPages') }}</p>
        <p class="mt-1 text-xl font-semibold text-white">{{ summary.totalPages }}</p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.totalMinutes') }}</p>
        <p class="mt-1 text-xl font-semibold text-white">{{ summary.totalMinutes }}</p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.currentStreak') }}</p>
        <p class="mt-1 text-xl font-semibold text-white">{{ summary.currentStreakDays }}</p>
      </article>
    </div>

    <div v-if="!loading" class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.bestStreak') }}</p>
        <p class="mt-1 text-lg font-semibold text-white">{{ summary.bestStreakDays }}</p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.sessionsThisWeek') }}</p>
        <p class="mt-1 text-lg font-semibold text-white">{{ summary.sessionsThisWeek }}</p>
      </article>
      <article class="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p class="text-[11px] uppercase tracking-wide text-slate-400">{{ t('stats.sessionsThisMonth') }}</p>
        <p class="mt-1 text-lg font-semibold text-white">{{ summary.sessionsThisMonth }}</p>
      </article>
    </div>

    <section v-if="!loading" class="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="text-sm font-semibold text-white">{{ t('stats.activityTitle') }}</p>
        <p class="text-xs text-slate-400">{{ t('stats.activitySubtitle') }}</p>
      </div>

      <div class="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
          <p class="text-[10px] uppercase tracking-wide text-slate-400">{{ t('stats.avgDailySessions') }}</p>
          <p class="mt-1 text-sm font-semibold text-cyan-300">{{ formatDecimal(averageDailySessions) }}</p>
        </article>
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
          <p class="text-[10px] uppercase tracking-wide text-slate-400">{{ t('stats.activeDays') }}</p>
          <p class="mt-1 text-sm font-semibold text-white">{{ activeDays }}</p>
        </article>
        <article class="rounded-lg border border-slate-800 bg-slate-900/70 p-2 col-span-2 sm:col-span-1">
          <p class="text-[10px] uppercase tracking-wide text-slate-400">{{ t('stats.peakDay') }}</p>
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
          :title="`${formatDayTitle(point.dayStart)}: ${point.sessionCount} ${t('stats.sessionsShort')}`"
        >
          <div class="relative flex h-36 w-full items-end rounded-md border border-slate-800 bg-slate-900/70 p-1">
            <div
              class="w-full rounded-sm transition"
              :class="
                point.sessionCount === 0
                  ? 'bg-slate-700/60'
                  : isToday(point.dayStart)
                    ? 'bg-amber-400'
                    : 'bg-cyan-400/90'
              "
              :style="{ height: barHeight(point.sessionCount) }"
            />
          </div>
          <span class="text-[10px]" :class="isToday(point.dayStart) ? 'text-amber-300' : 'text-slate-400'">
            {{ formatDayLabel(point.dayStart) }}
          </span>
          <span class="text-[10px] font-semibold text-slate-300">{{ point.sessionCount }}</span>
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

    <p v-if="!loading && filteredSessions.length === 0" class="mt-4 text-sm text-slate-400">
      {{ t('stats.empty') }}
    </p>
  </section>
</template>
