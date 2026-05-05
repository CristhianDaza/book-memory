<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  BookOpen,
  ChevronDown,
  Download,
  Globe2,
  Laptop,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import IconButton from '../ui/IconButton.vue'
import NavItem from '../ui/NavItem.vue'
import StatusBadge from '../ui/StatusBadge.vue'
import ThemeToggle from '../ui/ThemeToggle.vue'
import { useTheme } from '../../composables/useTheme'
import type { ThemeMode } from '../../types/theme'

interface ShellNavItem {
  to: string
  label: string
  active: boolean
  icon: Component
}

defineProps<{
  navItems: ShellNavItem[]
  showChrome: boolean
  syncVisible: boolean
  syncTone: 'success' | 'warning' | 'danger'
  syncMessage: string
  nextLocaleLabel: string
  exportingData: boolean
  exportLabel: string
  exportAriaLabel: string
  deleteLabel: string
  signOutLabel: string
  currentYear: number
  appVersion: string
}>()

defineEmits<{
  changeLocale: []
  exportData: []
  deleteAccount: []
  signOut: []
}>()

const { t, locale } = useI18n()
const { themeMode, setThemeMode } = useTheme()

const nextThemeMode = computed<ThemeMode>(() => {
  if (themeMode.value === 'system') return 'light'
  if (themeMode.value === 'light') return 'dark'
  return 'system'
})

const themeLabel = computed(() => {
  if (themeMode.value === 'system') return t('theme.system')
  if (themeMode.value === 'light') return t('theme.light')
  return t('theme.dark')
})

const themeIcon = computed<Component>(() => {
  if (themeMode.value === 'system') return Laptop
  if (themeMode.value === 'light') return Sun
  return Moon
})

const currentLanguageLabel = computed(() =>
  locale.value === 'es' ? t('common.spanishFull') : t('common.englishFull'),
)

function onToggleTheme() {
  setThemeMode(nextThemeMode.value)
}
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
            <BookOpen
              :size="21"
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
          <IconButton
            :label="t('common.switchLanguage', { language: nextLocaleLabel })"
            @click="$emit('changeLocale')"
          >
            <Globe2
              :size="18"
              aria-hidden="true"
            />
          </IconButton>
        </div>
      </header>

      <div class="bm-shell">
        <aside class="bm-sidebar">
          <RouterLink
            to="/"
            class="bm-brand"
          >
            <span class="bm-brand-mark">
              <BookOpen
                :size="22"
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

          <div class="grid gap-3">
            <section class="bm-sidebar-section">
              <p class="bm-sidebar-section-title">{{ t('home.sessionSection') }}</p>
              <button
                type="button"
                class="bm-button w-full"
                @click="$emit('signOut')"
              >
                <LogOut
                  :size="17"
                  aria-hidden="true"
                />
                {{ signOutLabel }}
              </button>
            </section>

            <details class="bm-sidebar-danger-zone">
              <summary>
                <span>{{ t('home.accountOptions') }}</span>
                <ChevronDown
                  :size="16"
                  aria-hidden="true"
                />
              </summary>
              <section class="bm-sidebar-section">
                <p class="bm-sidebar-section-title">{{ t('home.preferences') }}</p>
                <button
                  type="button"
                  class="bm-sidebar-action-row bm-sidebar-action-button"
                  :aria-label="t('theme.toggle')"
                  @click="onToggleTheme"
                >
                  <span class="bm-sidebar-action-copy">
                    <span class="bm-sidebar-action-label">{{ t('theme.setting') }}</span>
                    <span class="bm-sidebar-action-value">{{ themeLabel }}</span>
                  </span>
                  <span class="bm-sidebar-action-icon">
                    <component
                      :is="themeIcon"
                      :size="18"
                      aria-hidden="true"
                    />
                  </span>
                </button>
                <button
                  type="button"
                  class="bm-sidebar-action-row bm-sidebar-action-button"
                  :aria-label="t('common.switchLanguage', { language: nextLocaleLabel })"
                  @click="$emit('changeLocale')"
                >
                  <span class="bm-sidebar-action-copy">
                    <span class="bm-sidebar-action-label">{{ t('common.language') }}</span>
                    <span class="bm-sidebar-action-value">{{ currentLanguageLabel }}</span>
                  </span>
                  <span class="bm-sidebar-action-icon">
                    <Globe2
                      :size="18"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </section>

              <section class="bm-sidebar-section">
                <p class="bm-sidebar-section-title">{{ t('home.dataSection') }}</p>
                <button
                  type="button"
                  class="bm-sidebar-action-row bm-sidebar-action-button"
                  :aria-label="exportAriaLabel"
                  :disabled="exportingData"
                  @click="$emit('exportData')"
                >
                  <span class="bm-sidebar-action-copy">
                    <span class="bm-sidebar-action-label">{{ t('home.exportData') }}</span>
                    <span class="bm-sidebar-action-value">{{ exportLabel }}</span>
                  </span>
                  <span class="bm-sidebar-action-icon">
                    <Download
                      :size="18"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </section>

              <section class="bm-sidebar-section">
                <p class="bm-sidebar-section-title">{{ t('home.dangerSection') }}</p>
                <p class="bm-muted text-xs leading-relaxed">{{ t('home.accountOptionsHint') }}</p>
                <button
                  type="button"
                  class="bm-button bm-button-danger w-full"
                  @click="$emit('deleteAccount')"
                >
                  <Trash2
                    :size="17"
                    aria-hidden="true"
                  />
                  {{ deleteLabel }}
                </button>
              </section>
            </details>
          </div>
        </aside>

        <main class="bm-main">
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
        </main>
      </div>

      <nav
        class="bm-bottom-nav"
        aria-label="Mobile primary"
      >
        <NavItem
          v-for="item in navItems"
          :key="`mobile-${item.to}`"
          v-bind="item"
        />
      </nav>
    </template>

    <main
      v-else
      class="bm-main bm-main-auth"
    >
      <div class="bm-content">
        <slot />
      </div>
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
