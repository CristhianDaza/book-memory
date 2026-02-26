import { defineStore } from 'pinia'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { computed, ref } from 'vue'
import { i18n } from '../i18n'
import { firebaseAuth, isFirebaseConfigured } from '../lib/firebase'

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

    initPromise = new Promise((resolve) => {
      if (!firebaseAuth || !isFirebaseConfigured()) {
        errorMessage.value = tAuthError('authErrors.firebaseConfigMissing')
        initialized.value = true
        resolve()
        return
      }

      initializing.value = true
      onAuthStateChanged(firebaseAuth, (nextUser) => {
        user.value = nextUser
        initialized.value = true
        initializing.value = false
        resolve()
      })
    })

    return initPromise
  }

  async function loginWithGoogle() {
    clearError()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return
    }

    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.googleSignInFailed')
    }
  }

  async function loginWithEmail(email: string, password: string) {
    clearError()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return
    }

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.emailSignInFailed')
    }
  }

  async function registerWithEmail(email: string, password: string) {
    clearError()
    if (!firebaseAuth) {
      errorMessage.value = tAuthError('authErrors.firebaseAuthNotConfigured')
      return
    }

    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.emailSignUpFailed')
    }
  }

  async function logout() {
    clearError()
    if (!firebaseAuth) return

    try {
      await signOut(firebaseAuth)
    } catch (error) {
      errorMessage.value = resolveErrorMessage(error, 'authErrors.signOutFailed')
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
    logout,
    clearError,
  }
})
