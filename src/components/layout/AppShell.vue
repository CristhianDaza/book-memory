<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from 'vue'
import {
  ArrowUp,
  Settings,
  ShieldCheck,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import NavItem from '../ui/NavItem.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import ThemeToggle from '../ui/ThemeToggle.vue'
import { useTheme } from '../../composables/useTheme'

interface ShellNavItem {
  to: string
  label: string
  active: boolean
  icon: Component
}

defineProps<{
  navItems: ShellNavItem[]
  mobileNavItems: ShellNavItem[]
  showChrome: boolean
  syncVisible: boolean
  syncTone: 'success' | 'warning' | 'danger'
  syncMessage: string
  currentYear: number
  appVersion: string
}>()

const { t } = useI18n()
const route = useRoute()
const { resolvedTheme } = useTheme()
const mainScrollTarget = ref<HTMLElement | null>(null)
const showScrollTop = ref(false)
const brandIconSrc = computed(() => `/icons/bookmemory-${resolvedTheme.value}-192.png`)

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function updateScrollTopVisibility() {
  showScrollTop.value = (mainScrollTarget.value?.scrollTop ?? 0) > 320
}

function scrollToTop() {
  const scrollTarget = mainScrollTarget.value
  if (!scrollTarget) return
  scrollTarget.scrollTo({
    top: 0,
    left: 0,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

watch(mainScrollTarget, (scrollTarget, previousTarget) => {
  previousTarget?.removeEventListener('scroll', updateScrollTopVisibility)
  scrollTarget?.addEventListener('scroll', updateScrollTopVisibility, { passive: true })
  updateScrollTopVisibility()
})

onBeforeUnmount(() => {
  mainScrollTarget.value?.removeEventListener('scroll', updateScrollTopVisibility)
})

watch(
  () => route.fullPath,
  async () => {
    await nextTick()
    const scrollTarget = mainScrollTarget.value
    if (!scrollTarget) return

    scrollTarget.scrollTo({
      top: 0,
      left: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
    showScrollTop.value = false
  },
)
</script>

<template>
  <div class="bm-app">
    <template v-if="showChrome">
      <header class="bm-mobile-header">
        <RouterLink
          to="/"
          class="bm-brand"
        >
          <span class="bm-brand-mark">
            <img
              class="bm-brand-icon"
              :src="brandIconSrc"
              alt=""
              width="44"
              height="44"
              aria-hidden="true"
            />
          </span>
          <span>
            <span class="bm-brand-title">BookMemory</span>
            <span class="bm-brand-subtitle">{{ appVersion }}</span>
          </span>
        </RouterLink>
        <div class="flex items-center gap-2">
          <ThemeToggle />
          <RouterLink
            to="/settings"
            class="bm-icon-button"
            :class="{ 'text-(--app-primary-strong)': route.name === 'settings' }"
            :aria-label="t('settings.open')"
            :title="t('settings.open')"
          >
            <Settings
              :size="18"
              aria-hidden="true"
            />
          </RouterLink>
        </div>
      </header>

      <div class="bm-shell">
        <aside class="bm-sidebar">
          <RouterLink
            to="/"
            class="bm-brand"
          >
            <span class="bm-brand-mark">
              <img
                class="bm-brand-icon"
                :src="brandIconSrc"
                alt=""
                width="44"
                height="44"
                aria-hidden="true"
              />
            </span>
            <span>
              <span class="bm-brand-title">BookMemory</span>
              <span class="bm-brand-subtitle">Reading journal</span>
            </span>
          </RouterLink>

          <nav
            class="bm-nav-list"
            aria-label="Primary"
          >
            <NavItem
              v-for="item in navItems"
              :key="item.to"
              v-bind="item"
            />
          </nav>
          <nav
            class="bm-nav-list"
            aria-label="Account"
          >
            <NavItem
              to="/settings"
              :label="t('settings.navLabel')"
              :active="route.name === 'settings'"
              :icon="Settings"
            />
          </nav>

          <div
            v-if="syncVisible"
            class="bm-subtle-panel mt-auto"
          >
            <div class="mb-2 flex items-center gap-2">
              <ShieldCheck
                :size="16"
                aria-hidden="true"
              />
              <StatusBadge :tone="syncTone">Sync</StatusBadge>
            </div>
            <p class="bm-muted text-xs leading-relaxed">{{ syncMessage }}</p>
          </div>
        </aside>

        <main
          ref="mainScrollTarget"
          class="bm-main"
        >
          <div class="bm-content">
            <section
              v-if="syncVisible"
              class="bm-subtle-panel mb-4 md:hidden"
            >
              <StatusBadge :tone="syncTone">Sync</StatusBadge>
              <p class="bm-muted mt-2 text-xs">{{ syncMessage }}</p>
            </section>
            <slot />
          </div>
          <Transition name="bm-scroll-top">
            <button
              v-if="showScrollTop"
              type="button"
              class="bm-scroll-top-button"
              :aria-label="t('common.scrollToTop')"
              :title="t('common.scrollToTop')"
              @click="scrollToTop"
            >
              <ArrowUp
                :size="18"
                aria-hidden="true"
              />
            </button>
          </Transition>
        </main>
      </div>

      <nav
        class="bm-bottom-nav"
        aria-label="Mobile primary"
      >
        <NavItem
          v-for="item in mobileNavItems"
          :key="`mobile-${item.to}`"
          v-bind="item"
        />
      </nav>
    </template>

    <main
      v-else
      ref="mainScrollTarget"
      class="bm-main bm-main-auth bm-auth-layout"
    >
      <div class="bm-content">
        <slot />
      </div>
      <Transition name="bm-scroll-top">
        <button
          v-if="showScrollTop"
          type="button"
          class="bm-scroll-top-button"
          :aria-label="t('common.scrollToTop')"
          :title="t('common.scrollToTop')"
          @click="scrollToTop"
        >
          <ArrowUp
            :size="18"
            aria-hidden="true"
          />
        </button>
      </Transition>
    </main>

    <footer
      class="bm-footer"
      :class="{ 'bm-footer-with-bottom-nav': showChrome }"
    >
      <div class="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p class="leading-relaxed">
          © {{ currentYear }} BookMemory. Designed &amp; Developed by
          <a
            href="https://cris-dev.com"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-(--app-primary-strong) underline underline-offset-2"
          >
            cris-dev
          </a>.
        </p>
        <p>{{ appVersion }}</p>
      </div>
    </footer>
  </div>
</template>
