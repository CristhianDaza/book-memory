import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from './LoginView.vue'
import { es } from '../../../i18n/messages/es'

const mocks = vi.hoisted(() => ({
  errorMessage: { value: null, __v_isRef: true },
  isAuthenticated: { value: false, __v_isRef: true },
  initializing: { value: false, __v_isRef: true },
  loginWithEmail: vi.fn(),
  loginWithGoogle: vi.fn(),
  clearError: vi.fn(),
}))

vi.mock('../../../stores/auth', () => ({ useAuthStore: () => mocks }))
vi.mock('pinia', async (importOriginal) => ({
  ...await importOriginal<typeof import('pinia')>(),
  storeToRefs: (store: unknown) => store,
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

function mountLogin() {
  return mount(LoginView, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'es', messages: { es } })],
      stubs: { ThemeToggle: true },
    },
  })
}

describe('LoginView interactions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prevents repeated authentication and mode changes while a request is pending', async () => {
    let finish: (() => void) | undefined
    mocks.loginWithEmail.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    const wrapper = mountLogin()
    await wrapper.get('input[type="email"]').setValue('reader@example.com')
    await wrapper.get('#auth-password').setValue('secure-password')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('form').trigger('submit')

    expect(mocks.loginWithEmail).toHaveBeenCalledTimes(1)
    expect(mocks.loginWithEmail).toHaveBeenCalledWith('reader@example.com', 'secure-password')
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.login-action-button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)

    finish?.()
    await flushPromises()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('false')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('reveals and hides the entered password without losing its value', async () => {
    const wrapper = mountLogin()
    await wrapper.get('#auth-password').setValue('secure-password')
    await wrapper.get('button[aria-label="Mostrar contraseña"]').trigger('click')
    expect(wrapper.get('#auth-password').attributes('type')).toBe('text')
    expect((wrapper.get('#auth-password').element as HTMLInputElement).value).toBe('secure-password')
    await wrapper.get('button[aria-label="Ocultar contraseña"]').trigger('click')
    expect(wrapper.get('#auth-password').attributes('type')).toBe('password')
    wrapper.unmount()
  })
})
