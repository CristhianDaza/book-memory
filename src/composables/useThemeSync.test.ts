import { flushPromises } from '@vue/test-utils'
import { effectScope, reactive, type EffectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemePreferences } from '../types/theme'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn() }))
const auth = reactive<{ user: { uid: string } | null }>({ user: null })
vi.mock('../stores/auth', () => ({ useAuthStore: () => auth }))
vi.mock('../services/themePreferencesService', () => ({
  fetchThemePreferences: mocks.fetch,
  saveThemePreferences: mocks.save,
}))

let scope: EffectScope

async function start(uid: string | null = 'reader-1') {
  auth.user = uid ? { uid } : null
  const { useTheme } = await import('./useTheme')
  const { useThemeSync, useThemeSyncStatus } = await import('./useThemeSync')
  scope = effectScope()
  scope.run(useThemeSync)
  return { ...useTheme(), ...useThemeSyncStatus() }
}

describe('account appearance sync', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.fetch.mockResolvedValue({ mode: 'dark', palette: 'ocean' })
    mocks.save.mockResolvedValue(undefined)
  })

  afterEach(() => {
    scope?.stop()
    vi.resetModules()
  })

  it('restores account preferences without writing them back', async () => {
    const theme = await start()
    await flushPromises()
    expect(theme.themeMode.value).toBe('dark')
    expect(theme.themePalette.value).toBe('ocean')
    expect(theme.syncStatus.value).toBe('saved')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('serializes rapid changes and saves the latest mode and palette', async () => {
    const theme = await start()
    await flushPromises()
    let finish: (() => void) | undefined
    mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    theme.setThemePalette('lavender')
    theme.setThemeMode('light')
    theme.setThemePalette('rose')
    expect(mocks.save).toHaveBeenCalledTimes(1)
    finish?.()
    await flushPromises()
    expect(mocks.save).toHaveBeenLastCalledWith('reader-1', { mode: 'light', palette: 'rose' })
    expect(theme.syncStatus.value).toBe('saved')
  })

  it('keeps edits made before account loading finishes', async () => {
    let finish: ((value: ThemePreferences) => void) | undefined
    mocks.fetch.mockImplementationOnce(() => new Promise<ThemePreferences>((resolve) => { finish = resolve }))
    const theme = await start()
    theme.setThemePalette('terracotta')
    finish?.({ mode: 'dark', palette: 'ocean' })
    await flushPromises()
    expect(theme.themePalette.value).toBe('terracotta')
    expect(mocks.save).toHaveBeenLastCalledWith('reader-1', { mode: 'system', palette: 'terracotta' })
  })

  it('keeps failed writes pending and retries without discarding the selection', async () => {
    const theme = await start()
    await flushPromises()
    mocks.save.mockRejectedValueOnce(new Error('offline'))
    theme.setThemePalette('slate')
    await flushPromises()
    expect(theme.syncStatus.value).toBe('error')
    const cached = JSON.parse(localStorage.getItem('bookmemory-appearance:reader-1')!)
    expect(cached).toEqual({ preferences: { mode: 'dark', palette: 'slate' }, pending: true })
    await theme.retryThemeSync()
    expect(theme.syncStatus.value).toBe('saved')
    expect(mocks.save).toHaveBeenLastCalledWith('reader-1', { mode: 'dark', palette: 'slate' })
  })

  it('replays a pending account choice after reloading', async () => {
    localStorage.setItem('bookmemory-appearance:reader-1', JSON.stringify({
      preferences: { mode: 'light', palette: 'lavender' }, pending: true,
    }))
    const theme = await start()
    await flushPromises()
    expect(theme.themePalette.value).toBe('lavender')
    expect(mocks.save).toHaveBeenCalledWith('reader-1', { mode: 'light', palette: 'lavender' })
  })

  it('ignores a late response from the previous account', async () => {
    let finish: ((value: ThemePreferences) => void) | undefined
    mocks.fetch.mockImplementationOnce(() => new Promise<ThemePreferences>((resolve) => { finish = resolve }))
    const theme = await start()
    auth.user = { uid: 'reader-2' }
    await flushPromises()
    finish?.({ mode: 'light', palette: 'rose' })
    await flushPromises()
    expect(theme.themePalette.value).toBe('ocean')
    theme.setThemePalette('slate')
    await flushPromises()
    expect(mocks.save).toHaveBeenLastCalledWith('reader-2', { mode: 'dark', palette: 'slate' })
  })

  it('does not write to the backend while signed out', async () => {
    const theme = await start(null)
    theme.setThemePalette('rose')
    expect(theme.syncStatus.value).toBe('local')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('migrates the local appearance for an account with no saved preferences', async () => {
    localStorage.setItem('bookmemory-theme', 'light')
    localStorage.setItem('bookmemory-palette', 'rose')
    mocks.fetch.mockResolvedValueOnce(null)
    const theme = await start()
    await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith('reader-1', { mode: 'light', palette: 'rose' })
    expect(theme.syncStatus.value).toBe('saved')
  })

  it('retries a failed read before saving, so an unread account choice is not overwritten', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('unavailable'))
    const theme = await start()
    await flushPromises()
    expect(theme.syncStatus.value).toBe('error')
    expect(mocks.save).not.toHaveBeenCalled()
    await theme.retryThemeSync()
    expect(theme.themePalette.value).toBe('ocean')
    expect(theme.syncStatus.value).toBe('saved')
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('preserves an appearance selected on the login screen for a new account', async () => {
    const theme = await start(null)
    theme.setThemeMode('dark')
    theme.setThemePalette('terracotta')
    mocks.fetch.mockResolvedValueOnce(null)
    auth.user = { uid: 'new-reader' }
    await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith('new-reader', { mode: 'dark', palette: 'terracotta' })
  })
})
