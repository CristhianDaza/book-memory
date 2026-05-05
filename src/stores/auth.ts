import { defineStore } from 'pinia'
import type { User } from 'firebase/auth'
import { computed, ref } from 'vue'
import { i18n } from '../i18n'
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase'
import { deleteUserData } from '../services/accountService'

let authSdkPromise: Promise<typeof import('firebase/auth')> | null = null
let authStateUnsubscribe: (() => void) | null = null

const firebaseAuthErrorKeys: Record<string, string> = {
  'auth/account-exists-with-different-credential': 'authErrors.accountExistsWithDifferentCredential',
  'auth/email-already-in-use': 'authErrors.emailAlreadyInUse',
  'auth/invalid-credential': 'authErrors.invalidCredentials',
  'auth/invalid-email': 'authErrors.invalidEmail',
  'auth/missing-password': 'authErrors.missingPassword',
  'auth/network-request-failed': 'authErrors.networkRequestFailed',
  'auth/operation-not-allowed': 'authErrors.operationNotAllowed',
  'auth/popup-blocked': 'authErrors.popupBlocked',
  'auth/popup-closed-by-user': 'authErrors.popupClosedByUser',
  'auth/requires-recent-login': 'authErrors.deleteAccountRequiresRecentLogin',
  'auth/too-many-requests': 'authErrors.tooManyRequests',
  'auth/user-disabled': 'authErrors.userDisabled',
  'auth/user-not-found': 'authErrors.invalidCredentials',
  'auth/weak-password': 'authErrors.weakPassword',
  'auth/wrong-password': 'authErrors.invalidCredentials',
}

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

  function getFirebaseAuthErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('code' in error)) return null
    return typeof error.code === 'string' ? error.code : null
  }

  function resolveErrorMessage(error: unknown, fallbackKey: string): string {
    const code = getFirebaseAuthErrorCode(error)
    if (code && firebaseAuthErrorKeys[code]) {
      return tAuthError(firebaseAuthErrorKeys[code])
    }
    return tAuthError(fallbackKey)
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
        let initializedResolved = false

        function completeInit() {
          if (initializedResolved) return
          initializedResolved = true
          initialized.value = true
          initializing.value = false
          resolve()
        }

        if (!authStateUnsubscribe) {
          authStateUnsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
            user.value = nextUser
            completeInit()
          })
          return
        }

        user.value = firebaseAuth.currentUser
        completeInit()
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
      errorMessage.value = resolveErrorMessage(error, 'authErrors.deleteAccountFailed')
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
