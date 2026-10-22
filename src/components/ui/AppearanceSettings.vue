<script setup lang="ts">
import { Check, Laptop, Moon, Palette, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { themePalettes } from '../../config/themePalettes'
import { useTheme } from '../../composables/useTheme'
import { useThemeSyncStatus } from '../../composables/useThemeSync'
import type { ThemeMode } from '../../types/theme'

const { t } = useI18n()
const { themeMode, themePalette, setThemeMode, setThemePalette } = useTheme()
const { syncStatus, retryThemeSync } = useThemeSyncStatus()
const modes = [
  { id: 'light' as ThemeMode, icon: Sun },
  { id: 'dark' as ThemeMode, icon: Moon },
  { id: 'system' as ThemeMode, icon: Laptop },
]
</script>

<template>
  <div class="bm-appearance">
    <div>
      <h2 class="bm-section-title flex items-center gap-2">
        <Palette :size="21" aria-hidden="true" />
        {{ t('theme.appearance') }}
      </h2>
      <p class="bm-muted mt-1 text-sm">{{ t('theme.appearanceHint') }}</p>
    </div>

    <fieldset>
      <legend class="bm-label mb-3">{{ t('theme.modeLabel') }}</legend>
      <div class="bm-theme-modes">
        <label v-for="mode in modes" :key="mode.id" class="bm-theme-mode">
          <input
            type="radio"
            name="appearance-mode"
            :value="mode.id"
            :checked="themeMode === mode.id"
            @change="setThemeMode(mode.id)"
          >
          <component :is="mode.icon" :size="18" aria-hidden="true" />
          <span>{{ t(`theme.${mode.id}`) }}</span>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend class="bm-label mb-1">{{ t('theme.paletteLabel') }}</legend>
      <p class="bm-muted mb-3 text-sm">{{ t('theme.paletteHint') }}</p>
      <div class="bm-theme-palettes">
        <label v-for="palette in themePalettes" :key="palette.id" class="bm-palette-option">
          <input
            type="radio"
            name="appearance-palette"
            :value="palette.id"
            :checked="themePalette === palette.id"
            @change="setThemePalette(palette.id)"
          >
          <span class="bm-palette-swatches" aria-hidden="true">
            <span v-for="color in palette.swatches" :key="color" :style="{ backgroundColor: color }" />
          </span>
          <span class="bm-palette-name">{{ t(`theme.palettes.${palette.id}`) }}</span>
          <Check v-if="themePalette === palette.id" class="bm-palette-check" :size="18" aria-hidden="true" />
        </label>
      </div>
    </fieldset>

    <div class="bm-appearance-feedback">
      <p class="bm-muted text-sm" role="status" aria-live="polite" aria-atomic="true">
        {{ t(`theme.sync_${syncStatus}`) }}
      </p>
      <button v-if="syncStatus === 'error'" type="button" class="bm-button" @click="retryThemeSync">
        {{ t('theme.retrySave') }}
      </button>
    </div>
  </div>
</template>
