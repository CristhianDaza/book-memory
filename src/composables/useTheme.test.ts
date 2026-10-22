import { describe, expect, it, vi, afterEach } from 'vitest'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

describe('useTheme', () => {
  afterEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme-mode')
    document.documentElement.removeAttribute('data-palette')
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('defaults to system and resolves from media query', async () => {
    stubMatchMedia(true)
    const { useTheme } = await import('./useTheme')

    const { themeMode, resolvedTheme } = useTheme()

    expect(themeMode.value).toBe('system')
    expect(resolvedTheme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('persists explicit light and dark modes', async () => {
    stubMatchMedia(false)
    const { useTheme } = await import('./useTheme')
    const { themeMode, resolvedTheme, setThemeMode } = useTheme()

    setThemeMode('dark')
    expect(themeMode.value).toBe('dark')
    expect(resolvedTheme.value).toBe('dark')
    expect(localStorage.getItem('bookmemory-theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    setThemeMode('light')
    expect(themeMode.value).toBe('light')
    expect(resolvedTheme.value).toBe('light')
    expect(localStorage.getItem('bookmemory-theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('uses stored theme mode on startup', async () => {
    localStorage.setItem('bookmemory-theme', 'light')
    stubMatchMedia(true)
    const { useTheme } = await import('./useTheme')

    const { themeMode, resolvedTheme } = useTheme()

    expect(themeMode.value).toBe('light')
    expect(resolvedTheme.value).toBe('light')
    expect(document.documentElement.dataset.themeMode).toBe('light')
  })

  it('restores a palette and keeps it when switching between light and dark', async () => {
    localStorage.setItem('bookmemory-palette', 'ocean')
    const { useTheme } = await import('./useTheme')
    const theme = useTheme()
    expect(theme.themePalette.value).toBe('ocean')
    theme.setThemeMode('dark')
    expect(document.documentElement.dataset.palette).toBe('ocean')
    theme.setThemePalette('rose')
    theme.setThemeMode('light')
    expect(document.documentElement.dataset.palette).toBe('rose')
    expect(localStorage.getItem('bookmemory-palette')).toBe('rose')
  })

  it('falls back from unknown palette IDs', async () => {
    localStorage.setItem('bookmemory-palette', 'unknown')
    const { useTheme } = await import('./useTheme')
    expect(useTheme().themePalette.value).toBe('forest')
  })
})
