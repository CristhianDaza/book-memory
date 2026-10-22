import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchThemePreferences, saveThemePreferences } from './themePreferencesService'

const mocks = vi.hoisted(() => ({ doc: vi.fn(() => 'appearance-ref'), getDoc: vi.fn(), setDoc: vi.fn() }))
vi.mock('../lib/firebase', () => ({ getFirebaseDb: vi.fn(async () => 'db') }))
vi.mock('firebase/firestore', () => ({ ...mocks, serverTimestamp: () => 'server-time' }))

describe('themePreferencesService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves only validated preferences under the authenticated user path', async () => {
    await saveThemePreferences('reader-1', { mode: 'dark', palette: 'ocean' })
    expect(mocks.doc).toHaveBeenCalledWith('db', 'users', 'reader-1', 'preferences', 'appearance')
    expect(mocks.setDoc).toHaveBeenCalledWith('appearance-ref', {
      mode: 'dark', palette: 'ocean', updatedAt: 'server-time',
    })
  })

  it('returns null for an account without saved preferences', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => false })
    expect(await fetchThemePreferences('reader-1')).toBeNull()
  })

  it('rejects unsupported backend values rather than applying them', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ mode: 'dark', palette: 'unknown' }) })
    await expect(fetchThemePreferences('reader-1')).rejects.toThrow('Invalid appearance')
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })

  it('does not accept an empty user ID', async () => {
    await expect(saveThemePreferences('', { mode: 'light', palette: 'forest' })).rejects.toThrow('A user is required')
    expect(mocks.setDoc).not.toHaveBeenCalled()
  })
})
