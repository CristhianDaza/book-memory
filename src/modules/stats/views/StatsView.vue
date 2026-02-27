<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStatsStore } from '../../../stores/stats'
import type { StatsRange } from '../../../types/stats'

const { t } = useI18n()
const statsStore = useStatsStore()
const { loading, errorKey, range, summary, filteredSessions } = storeToRefs(statsStore)

const mappedError = computed(() => (errorKey.value ? t(errorKey.value) : null))

function onChangeRange(nextRange: StatsRange) {
  statsStore.setRange(nextRange)
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

    <p v-if="!loading && filteredSessions.length === 0" class="mt-4 text-sm text-slate-400">
      {{ t('stats.empty') }}
    </p>
  </section>
</template>
