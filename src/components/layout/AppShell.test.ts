import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell.vue'

const routeState = vi.hoisted(() => ({
  name: 'home',
  fullPath: '/',
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  RouterLink: {
    props: ['to'],
    template: '<a href="#"><slot /></a>',
  },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

function mountShell() {
  return mount(AppShell, {
    props: {
      navItems: [],
      showChrome: true,
      syncVisible: false,
      syncTone: 'success',
      syncMessage: '',
      currentYear: 2026,
      appVersion: 'v-test',
    },
    global: {
      stubs: {
        NavItem: true,
        RouterLink: {
          props: ['to'],
          template: '<a href="#"><slot /></a>',
        },
        StatusBadge: true,
        ThemeToggle: true,
      },
    },
  })
}

describe('AppShell scroll to top', () => {
  it('shows the subtle scroll button after scrolling and sends the main content to top', async () => {
    const wrapper = mountShell()
    const main = wrapper.find('.bm-main')
    const scrollTo = vi.fn()
    Object.defineProperty(main.element, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })

    main.element.scrollTop = 400
    await main.trigger('scroll')
    await nextTick()

    const button = wrapper.find('.bm-scroll-top-button')
    expect(button.exists()).toBe(true)

    await button.trigger('click')

    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'smooth',
    })
  })
})
