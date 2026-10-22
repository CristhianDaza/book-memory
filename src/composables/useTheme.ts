import { computed, readonly, ref } from 'vue'
import type { ResolvedTheme, ThemeMode, ThemePalette, ThemePreferences } from '../types/theme'
import { isThemeMode, isThemePalette } from '../config/themePalettes'

const storageKey = 'bookmemory-theme'
const themeMode = ref<ThemeMode>('system')
const themePalette = ref<ThemePalette>('forest')
const themeRevision = ref(0)
const systemTheme = ref<ResolvedTheme>('light')
let initialized = false
let mediaQuery: MediaQueryList | null = null

const resolvedTheme = computed<ResolvedTheme>(() =>
  themeMode.value === 'system' ? systemTheme.value : themeMode.value,
)

function readStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(storageKey)
    return isThemeMode(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function persistTheme(nextTheme: ThemeMode) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey, nextTheme)
    localStorage.setItem('bookmemory-palette', themePalette.value)
  } catch { /* Appearance still works when browser storage is unavailable. */ }
}

function applyTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.dataset.themeMode = themeMode.value
  document.documentElement.dataset.palette = themePalette.value
}

function updateSystemTheme() {
  systemTheme.value = mediaQuery?.matches ? 'dark' : 'light'
  applyTheme()
}

export function initTheme() {
  if (initialized) return
  initialized = true
  themeMode.value = readStoredTheme()
  try {
    const stored = localStorage.getItem('bookmemory-palette')
    if (isThemePalette(stored)) themePalette.value = stored
  } catch { /* Use the default palette when storage is unavailable. */ }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)
  } else {
    applyTheme()
  }
}

export function useTheme() {
  initTheme()

  function setThemeMode(nextTheme: ThemeMode) {
    if (!isThemeMode(nextTheme) || themeMode.value === nextTheme) return
    themeMode.value = nextTheme
    persistTheme(nextTheme)
    applyTheme()
    themeRevision.value++
  }

  function setThemePalette(nextPalette: ThemePalette) {
    if (!isThemePalette(nextPalette) || themePalette.value === nextPalette) return
    themePalette.value = nextPalette
    persistTheme(themeMode.value)
    applyTheme()
    themeRevision.value++
  }

  // Loading account preferences must not trigger another cloud write.
  function restoreThemePreferences(preferences: ThemePreferences) {
    themeMode.value = preferences.mode
    themePalette.value = preferences.palette
    persistTheme(preferences.mode)
    applyTheme()
  }

  return {
    themeMode: readonly(themeMode),
    themePalette: readonly(themePalette),
    themeRevision: readonly(themeRevision),
    resolvedTheme,
    setThemeMode,
    setThemePalette,
    restoreThemePreferences,
  }
}
