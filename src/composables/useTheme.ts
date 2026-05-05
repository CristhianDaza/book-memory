import { computed, readonly, ref } from 'vue'
import type { ResolvedTheme, ThemeMode } from '../types/theme'

const storageKey = 'bookmemory-theme'
const validThemeModes = new Set<ThemeMode>(['system', 'light', 'dark'])
const themeMode = ref<ThemeMode>('system')
const systemTheme = ref<ResolvedTheme>('light')
let initialized = false
let mediaQuery: MediaQueryList | null = null

const resolvedTheme = computed<ResolvedTheme>(() =>
  themeMode.value === 'system' ? systemTheme.value : themeMode.value,
)

function readStoredTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'system'
  const stored = localStorage.getItem(storageKey)
  return validThemeModes.has(stored as ThemeMode) ? (stored as ThemeMode) : 'system'
}

function persistTheme(nextTheme: ThemeMode) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(storageKey, nextTheme)
}

function applyTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.dataset.themeMode = themeMode.value
}

function updateSystemTheme() {
  systemTheme.value = mediaQuery?.matches ? 'dark' : 'light'
  applyTheme()
}

export function initTheme() {
  if (initialized) return
  initialized = true
  themeMode.value = readStoredTheme()

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
    themeMode.value = nextTheme
    persistTheme(nextTheme)
    applyTheme()
  }

  return {
    themeMode: readonly(themeMode),
    resolvedTheme,
    setThemeMode,
  }
}
