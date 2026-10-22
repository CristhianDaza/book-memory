<script setup lang="ts">
import { computed } from 'vue'
import {
  CloudUpload,
  Download,
  Globe2,
  LogOut,
  ShieldAlert,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import PageHeader from '../components/ui/PageHeader.vue'
import SurfaceCard from '../components/ui/SurfaceCard.vue'
import AppearanceSettings from '../components/ui/AppearanceSettings.vue'

defineProps<{
  nextLocaleLabel: string
  exportingData: boolean
  exportLabel: string
  exportAriaLabel: string
}>()

defineEmits<{
  changeLocale: []
  exportData: []
  openSyncCenter: []
  deleteAccount: []
  signOut: []
}>()

const { t, locale } = useI18n()

const currentLanguageLabel = computed(() =>
  locale.value === 'es' ? t('common.spanishFull') : t('common.englishFull'),
)

</script>

<template>
  <section class="bm-page">
    <PageHeader
      :eyebrow="t('settings.eyebrow')"
      :title="t('settings.title')"
      :subtitle="t('settings.subtitle')"
    />

    <div class="bm-settings-grid">
      <SurfaceCard class="bm-settings-appearance">
        <AppearanceSettings />
      </SurfaceCard>
      <SurfaceCard>
        <div class="mb-4">
          <h2 class="bm-section-title">{{ t('settings.preferencesTitle') }}</h2>
          <p class="bm-muted mt-1 text-sm">{{ t('settings.preferencesHint') }}</p>
        </div>

        <div class="grid gap-3">
          <button
            type="button"
            class="bm-settings-action"
            :aria-label="t('common.switchLanguage', { language: nextLocaleLabel })"
            @click="$emit('changeLocale')"
          >
            <span class="bm-settings-action-copy">
              <span class="bm-settings-action-label">{{ t('common.language') }}</span>
              <span class="bm-settings-action-value">{{ currentLanguageLabel }}</span>
            </span>
            <span class="bm-settings-action-icon">
              <Globe2
                :size="19"
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div class="mb-4">
          <h2 class="bm-section-title">{{ t('settings.dataTitle') }}</h2>
          <p class="bm-muted mt-1 text-sm">{{ t('settings.dataHint') }}</p>
        </div>

        <div class="grid gap-3">
          <button
            type="button"
            class="bm-settings-action"
            :aria-label="t('home.openBackupCenterAria')"
            @click="$emit('openSyncCenter')"
          >
            <span class="bm-settings-action-copy">
              <span class="bm-settings-action-label">{{ t('home.openBackupCenter') }}</span>
              <span class="bm-settings-action-value">{{ t('settings.backupHint') }}</span>
            </span>
            <span class="bm-settings-action-icon">
              <CloudUpload
                :size="19"
                aria-hidden="true"
              />
            </span>
          </button>

          <button
            type="button"
            class="bm-settings-action"
            :aria-label="exportAriaLabel"
            :disabled="exportingData"
            @click="$emit('exportData')"
          >
            <span class="bm-settings-action-copy">
              <span class="bm-settings-action-label">{{ t('home.exportData') }}</span>
              <span class="bm-settings-action-value">{{ exportLabel }}</span>
            </span>
            <span class="bm-settings-action-icon">
              <Download
                :size="19"
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <div class="mb-4">
          <h2 class="bm-section-title">{{ t('settings.sessionTitle') }}</h2>
          <p class="bm-muted mt-1 text-sm">{{ t('settings.sessionHint') }}</p>
        </div>

        <button
          type="button"
          class="bm-button w-full"
          @click="$emit('signOut')"
        >
          <LogOut
            :size="17"
            aria-hidden="true"
          />
          {{ t('home.signOut') }}
        </button>
      </SurfaceCard>

      <SurfaceCard>
        <div class="mb-4">
          <h2 class="bm-section-title text-(--app-danger)">{{ t('settings.dangerTitle') }}</h2>
          <p class="bm-muted mt-1 text-sm">{{ t('settings.dangerHint') }}</p>
        </div>

        <button
          type="button"
          class="bm-button bm-button-danger w-full"
          @click="$emit('deleteAccount')"
        >
          <ShieldAlert
            :size="17"
            aria-hidden="true"
          />
          {{ t('home.deleteAccount') }}
        </button>
      </SurfaceCard>
    </div>
  </section>
</template>
