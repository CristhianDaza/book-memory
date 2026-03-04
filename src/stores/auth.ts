import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { computed, ref } from 'vue'
import { i18n } from '../i18n'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'

let authSdkPromise: Promise<typeof import('firebase/auth')> | null = null

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
        const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
          user.value = nextUser
          initialized.value = true
          initializing.value = false
          unsubscribe()
          resolve()
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
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
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
      await signInWithEmailAndPassword(firebaseAuth, email, password)
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
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
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
    logout,
    clearError,
  }
})
