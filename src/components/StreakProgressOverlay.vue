<script setup lang="ts">
import { computed } from 'vue'
import { Check, Flame } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { StreakOverlayPayload } from '../types/streak'

defineProps<{
  visible: boolean
  payload: StreakOverlayPayload | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t, locale } = useI18n()

const dayFormatter = computed(() => new Intl.DateTimeFormat(locale.value, { weekday: 'short' }))

function formatDay(dayId: string): string {
  const [year, month, day] = dayId.split('-').map(Number)
  if (!year || !month || !day) return dayId
  return dayFormatter.value.format(new Date(year, month - 1, day))
}

function onClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="streak-fade">
      <div
        v-if="visible && payload"
        class="spo-overlay"
      >
        <div class="spo-card">
          <div class="spo-rings">
            <span class="spo-ring spo-ring-one" />
            <span class="spo-ring spo-ring-two" />
            <span class="spo-icon">
              <Flame
                :size="42"
                aria-hidden="true"
              />
            </span>
          </div>

          <p class="spo-eyebrow">{{ t('streak.modalEyebrow') }}</p>
          <h2 class="spo-title">{{ t('streak.modalTitle', { count: payload.currentStreakDays }) }}</h2>
          <p class="spo-subtitle">
            {{ t('streak.actionUnlocked', { action: t(`streak.actions.${payload.action}`) }) }}
          </p>

          <div class="spo-stats">
            <article>
              <p>{{ t('streak.current') }}</p>
              <strong>{{ payload.currentStreakDays }}</strong>
            </article>
            <article>
              <p>{{ t('streak.best') }}</p>
              <strong>{{ payload.bestStreakDays }}</strong>
            </article>
          </div>

          <div class="spo-days">
            <span
              v-for="day in payload.recentDays"
              :key="day.dayId"
              class="spo-day"
              :class="{ 'spo-day-active': day.active, 'spo-day-today': day.today }"
            >
              <span class="spo-day-dot">
                <Check
                  v-if="day.active"
                  :size="13"
                  aria-hidden="true"
                />
              </span>
              <span class="spo-day-label">{{ formatDay(day.dayId) }}</span>
            </span>
          </div>

          <button
            type="button"
            class="spo-close"
            @click="onClose"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.streak-fade-enter-active,
.streak-fade-leave-active {
  transition: opacity 0.25s ease;
}

.streak-fade-enter-from,
.streak-fade-leave-to {
  opacity: 0;
}

.spo-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.68);
  backdrop-filter: blur(5px);
}

.spo-card {
  width: min(100%, 26rem);
  overflow: hidden;
  border: 1px solid var(--app-border);
  border-radius: 1rem;
  background: var(--app-surface);
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 24px 56px rgba(0, 0, 0, 0.28);
  animation: spo-pop 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes spo-pop {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.spo-rings {
  position: relative;
  display: grid;
  place-items: center;
  height: 6rem;
}

.spo-ring,
.spo-icon {
  position: absolute;
  border-radius: 999px;
}

.spo-ring {
  border: 1px solid var(--app-warning);
  opacity: 0;
  animation: spo-ring 1.5s ease-out infinite;
}

.spo-ring-one {
  width: 4.5rem;
  height: 4.5rem;
}

.spo-ring-two {
  width: 5.75rem;
  height: 5.75rem;
  animation-delay: 0.2s;
}

@keyframes spo-ring {
  0% {
    opacity: 0.55;
    transform: scale(0.7);
  }
  100% {
    opacity: 0;
    transform: scale(1.15);
  }
}

.spo-icon {
  display: grid;
  width: 4rem;
  height: 4rem;
  place-items: center;
  color: var(--app-primary-contrast);
  background: var(--app-warning);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}

.spo-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
  text-transform: uppercase;
  color: var(--app-text-soft);
}

.spo-title {
  margin: 0.45rem 0 0;
  font-size: 1.55rem;
  font-weight: 900;
  color: var(--app-text);
}

.spo-subtitle {
  margin: 0.5rem auto 0;
  max-width: 20rem;
  font-size: 0.9rem;
  color: var(--app-text-muted);
}

.spo-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.spo-stats article {
  border: 1px solid var(--app-border);
  border-radius: 0.75rem;
  background: var(--app-surface-muted);
  padding: 0.75rem;
}

.spo-stats p {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--app-text-soft);
}

.spo-stats strong {
  display: block;
  margin-top: 0.2rem;
  font-size: 1.55rem;
  line-height: 1;
  color: var(--app-text);
}

.spo-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.35rem;
  margin-top: 1rem;
}

.spo-day {
  display: grid;
  min-width: 0;
  justify-items: center;
  gap: 0.25rem;
}

.spo-day-dot {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  color: var(--app-text-soft);
  background: var(--app-surface-muted);
}

.spo-day-active .spo-day-dot {
  color: var(--app-primary-contrast);
  background: var(--app-success);
  border-color: var(--app-success);
  animation: spo-day-in 0.35s ease both;
}

.spo-day-today .spo-day-dot {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-warning) 28%, transparent);
}

@keyframes spo-day-in {
  from {
    transform: scale(0.72);
  }
  to {
    transform: scale(1);
  }
}

.spo-day-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.65rem;
  color: var(--app-text-muted);
}

.spo-close {
  width: 100%;
  margin-top: 1.25rem;
  border: 0;
  border-radius: 0.6rem;
  background: var(--app-primary);
  color: var(--app-primary-contrast);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 800;
  padding: 0.8rem 1rem;
  transition: background 0.2s ease, transform 0.2s ease;
}

.spo-close:hover {
  background: var(--app-primary-strong);
}

.spo-close:active {
  transform: scale(0.98);
}
</style>
