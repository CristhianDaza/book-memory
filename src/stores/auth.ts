import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { computed, ref } from 'vue'
import { i18n } from '../i18n'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { deleteUserData } from '../services/accountService'

let authSdkPromise: Promise<typeof import('firebase/auth')> | null = null
const AUTH_INIT_TIMEOUT_MS = 3000

function getAuthSdk() {
  if (!authSdkPromise) {
    authSdkPromise = import('firebase/auth')
  }
  return authSdkPromise
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const initializing = ref(false)
  const initialized = ref(false)
  const errorMessage = ref<string | null>(null)
  let initPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => Boolean(user.value))

  function clearError() {
    errorMessage.value = null
  }

  function tAuthError(key: string): string {
    return i18n.global.t(key)
  }

  function resolveErrorMessage(error: unknown, fallbackKey: string): string {
    return error instanceof Error && error.message ? error.message : tAuthError(fallbackKey)
  }

  function initAuth() {
    if (initialized.value) return Promise.resolve()
    if (initPromise) return initPromise

    initPromise = (async () => {
      if (!isFirebaseConfigured()) {
        errorMessage.value = tAuthError('authErrors.firebaseConfigMissing')
        initialized.value = true
        return
      }

      const firebaseAuth = await getFirebaseAuth()
      if (!firebaseAuth) {
        errorMessage.value = tAuthError('authErrors.firebaseConfigMissing')
        initialized.value = true
        return
      }

      const { onAuthStateChanged } = await getAuthSdk()
      initializing.value = true
      await new Promise<void>((resolve) => {
        let settled = false
        let timeout: ReturnType<typeof setTimeout> | null = null
        let unsubscribe: (() => void) | null = null

        function finalize(nextUser: User | null) {
          if (settled) return
          settled = true
          user.value = nextUser
          initialized.value = true
          initializing.value = false
          if (timeout) {
            clearTimeout(timeout)
            timeout = null
          }
          if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
          }
          resolve()
        }

        timeout = setTimeout(() => {
          finalize(firebaseAuth.currentUser ?? null)
        }, AUTH_INIT_TIMEOUT_MS)

        unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
          finalize(nextUser)
        })
      })
    })()

    return initPromise
  }

  async function loginWithGoogle() {
    clearError()
    const firebaseAuth = await getFirebaseAuth()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return
    }

    try {
      const { GoogleAuthProvider, signInWithPopup } = await getAuthSdk()
      const credential = await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
      user.value = credential.user
      initialized.value = true
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.googleSignInFailed')
    }
  }

  async function loginWithEmail(email: string, password: string) {
    clearError()
    const firebaseAuth = await getFirebaseAuth()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return
    }

    try {
      const { signInWithEmailAndPassword } = await getAuthSdk()
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
      user.value = credential.user
      initialized.value = true
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.emailSignInFailed')
    }
  }

  async function registerWithEmail(email: string, password: string) {
    clearError()
    const firebaseAuth = await getFirebaseAuth()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return
    }

    try {
      const { createUserWithEmailAndPassword } = await getAuthSdk()
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      user.value = credential.user
      initialized.value = true
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.emailSignUpFailed')
    }
  }

  async function logout() {
    clearError()
    const firebaseAuth = await getFirebaseAuth()
    if (!firebaseAuth) return

    try {
      const { signOut } = await getAuthSdk()
      await signOut(firebaseAuth)
      user.value = null
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.signOutFailed')
    }
  }

  async function sendPasswordReset(email: string) {
    clearError()
    const firebaseAuth = await getFirebaseAuth()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return false
    }

    try {
      const { sendPasswordResetEmail } = await getAuthSdk()
      await sendPasswordResetEmail(firebaseAuth, email)
      return true
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.passwordResetFailed')
      return false
    }
  }

  async function deleteAccount() {
    clearError()
    const firebaseAuth = await getFirebaseAuth()
    const currentUser = firebaseAuth?.currentUser
    if (!firebaseAuth || !currentUser) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return false
    }

    try {
      await deleteUserData(currentUser.uid)
      const { deleteUser } = await getAuthSdk()
      await deleteUser(currentUser)
      return true
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
      if (code.includes('requires-recent-login')) {
        errorMessage.value = tAuthError('authErrors.deleteAccountRequiresRecentLogin')
      } else {
        errorMessage.value = resolveErrorMessage(error, 'authErrors.deleteAccountFailed')
      }
      return false
    }
  }

  return {
    user,
    initializing,
    initialized,
    errorMessage,
    isAuthenticated,
    initAuth,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendPasswordReset,
    deleteAccount,
    logout,
    clearError,
  }
})
