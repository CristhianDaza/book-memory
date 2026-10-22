import { onScopeDispose, readonly, ref, watch } from 'vue'
import { isThemePreferences } from '../config/themePalettes'
import { fetchThemePreferences, saveThemePreferences } from '../services/themePreferencesService'
import { useAuthStore } from '../stores/auth'
import type { ThemePreferences } from '../types/theme'
import { useTheme } from './useTheme'

type SyncStatus = 'local' | 'loading' | 'saving' | 'saved' | 'error'
const syncStatus = ref<SyncStatus>('local')
let retrySync: (() => Promise<void>) | null = null

interface AccountSession {
  uid: string
  ready: boolean
  dirty: boolean
  saving: boolean
}

function readCache(uid: string): { preferences: ThemePreferences; pending: boolean } | null {
  try {
    const data = JSON.parse(localStorage.getItem(`bookmemory-appearance:${uid}`) ?? 'null')
    return data && isThemePreferences(data.preferences) && typeof data.pending === 'boolean' ? data : null
  } catch {
    return null
  }
}

export function useThemeSyncStatus() {
  return { syncStatus: readonly(syncStatus), retryThemeSync: () => retrySync?.() }
}

/** Install once in the app shell; every theme control shares the same account sync. */
export function useThemeSync() {
  const auth = useAuthStore()
  const theme = useTheme()
  let session: AccountSession | null = null
  const preferences = (): ThemePreferences => ({ mode: theme.themeMode.value, palette: theme.themePalette.value })
  let guestPreferences = preferences()

  function cache(account: AccountSession, pending: boolean) {
    try {
      localStorage.setItem(`bookmemory-appearance:${account.uid}`, JSON.stringify({ preferences: preferences(), pending }))
    } catch { /* Cloud saving remains available without browser storage. */ }
  }

  async function save(account: AccountSession) {
    if (!account.ready || account.saving || session !== account) return
    account.saving = true
    try {
      // Serialize writes so a slow response cannot replace a more recent selection.
      while (account.dirty && session === account) {
        account.dirty = false
        syncStatus.value = 'saving'
        try {
          await saveThemePreferences(account.uid, preferences())
        } catch {
          if (session !== account) return
          account.dirty = true
          syncStatus.value = 'error'
          cache(account, true)
          return
        }
      }
      if (session === account) {
        cache(account, false)
        syncStatus.value = 'saved'
      }
    } finally {
      account.saving = false
    }
  }

  async function load(account: AccountSession) {
    syncStatus.value = 'loading'
    try {
      const saved = await fetchThemePreferences(account.uid)
      if (session !== account) return
      account.ready = true
      if (!account.dirty && saved) {
        theme.restoreThemePreferences(saved)
        cache(account, false)
        syncStatus.value = 'saved'
      } else {
        // First login migrates the local choice; pending local edits survive a reload.
        account.dirty = true
        cache(account, true)
        await save(account)
      }
    } catch {
      if (session === account) syncStatus.value = 'error'
    }
  }

  watch(() => auth.user?.uid, (uid) => {
    session = uid ? { uid, ready: false, dirty: false, saving: false } : null
    if (!session) {
      syncStatus.value = 'local'
      return
    }
    const cached = readCache(session.uid)
    session.dirty = cached?.pending ?? false
    theme.restoreThemePreferences(cached?.preferences ?? guestPreferences)
    void load(session)
  }, { immediate: true, flush: 'sync' })

  watch(theme.themeRevision, () => {
    if (!session) {
      guestPreferences = preferences()
      return
    }
    session.dirty = true
    cache(session, true)
    if (session.ready) void save(session)
  }, { flush: 'sync' })

  const retry = async () => {
    if (!session || session.saving || syncStatus.value === 'loading') return
    if (!session.ready) await load(session)
    else if (session.dirty) await save(session)
  }
  retrySync = retry
  const onOnline = () => { if (syncStatus.value === 'error') void retry() }
  window.addEventListener('online', onOnline)
  onScopeDispose(() => {
    session = null
    if (retrySync === retry) retrySync = null
    window.removeEventListener('online', onOnline)
  })
}
