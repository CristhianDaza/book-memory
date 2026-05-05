<script setup lang="ts">
import { computed } from 'vue'
import { Laptop, Moon, Sun } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useTheme } from '../../composables/useTheme'
import type { ThemeMode } from '../../types/theme'

const { t } = useI18n()
const { themeMode, setThemeMode } = useTheme()

const nextThemeMode = computed<ThemeMode>(() => {
  if (themeMode.value === 'system') return 'light'
  if (themeMode.value === 'light') return 'dark'
  return 'system'
})

const label = computed(() => {
  if (themeMode.value === 'system') return t('theme.system')
  if (themeMode.value === 'light') return t('theme.light')
  return t('theme.dark')
})

function onToggleTheme() {
  setThemeMode(nextThemeMode.value)
}
</script>

<template>
  <button
    type="button"
    class="bm-icon-button"
    :aria-label="t('theme.toggle')"
    :title="label"
    @click="onToggleTheme"
  >
    <Laptop
      v-if="themeMode === 'system'"
      :size="18"
      aria-hidden="true"
    />
    <Sun
      v-else-if="themeMode === 'light'"
      :size="18"
      aria-hidden="true"
    />
    <Moon
      v-else
      :size="18"
      aria-hidden="true"
    />
  </button>
</template>
