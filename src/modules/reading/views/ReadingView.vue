<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section class="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7">
    <p class="text-xs uppercase tracking-[0.18em] text-cyan-300">{{ t('modules.readingLabel') }}</p>
    <h1 class="mt-2 text-2xl font-semibold text-white">{{ t('modules.readingTitle') }}</h1>
    <p class="mt-3 text-sm text-slate-300">
      {{ t('modules.readingBody') }}
    </p>
  </section>
</template>
