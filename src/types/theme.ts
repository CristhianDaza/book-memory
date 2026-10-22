export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type ThemePalette = 'forest' | 'ocean' | 'lavender' | 'terracotta' | 'rose' | 'slate'

export interface ThemePreferences {
  mode: ThemeMode
  palette: ThemePalette
}
