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

  function initAuth() {
    if (initialized.value) return Promise.resolve()
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      if (!firebaseAuth || !isFirebaseConfigured()) {
        errorMessage.value = 'Firebase is not configured. Fill the VITE_FIREBASE_* variables.'
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
      errorMessage.value = 'Firebase auth is not configured.'
      return
    }

    try {
      await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Google sign-in failed.'
    }
  }

  async function loginWithEmail(email: string, password: string) {
    clearError()
    if (!firebaseAuth) {
      errorMessage.value = 'Firebase auth is not configured.'
      return
    }

    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Email sign-in failed.'
    }
  }

  async function registerWithEmail(email: string, password: string) {
    clearError()
    if (!firebaseAuth) {
      errorMessage.value = 'Firebase auth is not configured.'
      return
    }

    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Email sign-up failed.'
    }
  }

  async function logout() {
    clearError()
    if (!firebaseAuth) return

    try {
      await signOut(firebaseAuth)
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Sign-out failed.'
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
