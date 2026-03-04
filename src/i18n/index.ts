import { createI18n } from 'vue-i18n'
import type { AppLocale } from '../types/i18n'
import { en } from './messages/en'
import { es } from './messages/es'

export const SUPPORTED_LOCALES = ['es', 'en'] as const

const STORAGE_KEY = 'book-memory-locale'

function detectInitialLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'es' || saved === 'en') return saved
  return 'es'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    es,
    en,
  },
})

export function setAppLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
}
