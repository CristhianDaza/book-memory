import type { ThemeMode, ThemePalette, ThemePreferences } from '../types/theme'

export const themePalettes: { id: ThemePalette; swatches: [string, string, string] }[] = [
  { id: 'forest', swatches: ['#28634d', '#94d4b1', '#f6f5f0'] },
  { id: 'ocean', swatches: ['#245fa1', '#9ecafa', '#f2f6fb'] },
  { id: 'lavender', swatches: ['#6543a1', '#cdb5f4', '#f7f4fb'] },
  { id: 'terracotta', swatches: ['#984527', '#f0b39a', '#fbf4ef'] },
  { id: 'rose', swatches: ['#9c3f65', '#f0b0cb', '#fbf3f6'] },
  { id: 'slate', swatches: ['#475569', '#c1cbd9', '#f4f6f8'] },
]

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function isThemePalette(value: unknown): value is ThemePalette {
  return themePalettes.some((palette) => palette.id === value)
}

export function isThemePreferences(value: unknown): value is ThemePreferences {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<ThemePreferences>
  return isThemeMode(data.mode) && isThemePalette(data.palette)
}
