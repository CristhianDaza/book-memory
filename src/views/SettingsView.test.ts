import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'
import SettingsView from './SettingsView.vue'
import { en } from '../i18n/messages/en'
import { es } from '../i18n/messages/es'

const mockSetThemeMode = vi.hoisted(() => vi.fn())

vi.mock('../composables/useTheme', () => ({
  useTheme: () => ({
    themeMode: { value: 'system' },
    setThemeMode: mockSetThemeMode,
  }),
}))

function makeI18n() {
  return createI18n({
    legacy: false,
    locale: 'es',
    fallbackLocale: 'en',
    messages: { es, en },
  })
}

function mountSettingsView() {
  return mount(SettingsView, {
    props: {
      nextLocaleLabel: 'EN',
      exportingData: false,
      exportLabel: 'Exportar datos',
      exportAriaLabel: 'Exportar datos',
    },
    global: {
      plugins: [makeI18n()],
    },
  })
}

describe('SettingsView', () => {
  it('renders the account settings sections', () => {
    const wrapper = mountSettingsView()

    expect(wrapper.text()).toContain('Ajustes')
    expect(wrapper.text()).toContain('Preferencias')
    expect(wrapper.text()).toContain('Datos y respaldo')
    expect(wrapper.text()).toContain('Sesión')
    expect(wrapper.text()).toContain('Zona sensible')
  })

  it('emits account actions from settings controls', async () => {
    const wrapper = mountSettingsView()

    await wrapper.findAll('button').find((button) => button.text().includes('Idioma'))?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Centro de respaldo'))?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Exportar datos'))?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Cerrar sesión'))?.trigger('click')
    await wrapper.findAll('button').find((button) => button.text().includes('Eliminar cuenta'))?.trigger('click')

    expect(wrapper.emitted('changeLocale')).toHaveLength(1)
    expect(wrapper.emitted('openSyncCenter')).toHaveLength(1)
    expect(wrapper.emitted('exportData')).toHaveLength(1)
    expect(wrapper.emitted('signOut')).toHaveLength(1)
    expect(wrapper.emitted('deleteAccount')).toHaveLength(1)
  })
})
