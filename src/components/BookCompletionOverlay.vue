<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'

defineProps<{
  visible: boolean
  title?: string
  authors?: string[]
  coverUrl?: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

function onClose() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay-fade">
      <div
        v-if="visible"
        class="bco-overlay"
      >
        <div class="bco-confetti-container">
          <div
            v-for="i in 30"
            :key="i"
            class="bco-confetti"
            :style="{
              '--bco-confetti-delay': `${(i * 0.05)}s`,
              '--bco-confetti-x': `${Math.random() * 100}%`,
              '--bco-confetti-color': i % 3 === 0 ? 'var(--app-success)' : i % 3 === 1 ? 'var(--app-warning)' : 'var(--app-primary)',
              '--bco-confetti-rotate': `${Math.random() * 360}deg`,
              '--bco-confetti-size': `${6 + Math.random() * 8}px`,
            }"
          />
        </div>

        <div class="bco-card">
          <div class="bco-cover-wrapper">
            <img
              v-if="coverUrl"
              :src="coverUrl"
              :alt="title"
              class="bco-cover"
            >
            <div
              v-else
              class="bco-cover-placeholder"
            >
              <Check
                :size="32"
              />
            </div>
          </div>

          <div class="bco-icon-wrapper">
            <div class="bco-icon-bg" />
            <Check
              :size="48"
              class="bco-check-icon"
            />
          </div>

          <h2 class="bco-title">
            {{ t('notifications.bookCompletedTitle') }}
          </h2>

          <p class="bco-subtitle">
            {{ t('notifications.bookCompletedSubtitle') }}
          </p>

          <div
            v-if="title"
            class="bco-book-info"
          >
            <p class="bco-book-title">
              {{ title }}
            </p>
            <p
              v-if="authors?.length"
              class="bco-book-authors"
            >
              {{ authors.join(', ') }}
            </p>
          </div>

          <button
            type="button"
            class="bco-close-btn"
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
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.bco-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.bco-confetti-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.bco-confetti {
  position: absolute;
  width: var(--bco-confetti-size);
  height: var(--bco-confetti-size);
  background: var(--bco-confetti-color);
  border-radius: 2px;
  left: var(--bco-confetti-x);
  top: -20px;
  opacity: 0;
  transform: rotate(var(--bco-confetti-rotate));
  animation: confetti-fall 2.5s ease-out var(--bco-confetti-delay) forwards;
}

@keyframes confetti-fall {
  0% {
    opacity: 1;
    transform: translateY(0) rotate(0deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(100vh) rotate(720deg) scale(0.5);
  }
}

.bco-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 2rem;
  background: var(--app-surface);
  border-radius: 1.5rem;
  border: 1px solid var(--app-border);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  text-align: center;
  animation: card-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes card-pop {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.bco-cover-wrapper {
  position: relative;
  margin-bottom: -1.5rem;
  z-index: 1;
}

.bco-cover {
  width: 80px;
  height: 120px;
  object-fit: cover;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.bco-cover-placeholder {
  width: 80px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-surface-muted);
  border-radius: 0.5rem;
  color: var(--app-text-muted);
}

.bco-icon-wrapper {
  position: relative;
  margin-top: -0.75rem;
  margin-bottom: 1rem;
}

.bco-icon-bg {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--app-success), var(--app-primary));
  animation: icon-pulse 0.6s ease-out forwards;
}

@keyframes icon-pulse {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.3;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

.bco-check-icon {
  position: relative;
  color: white;
  animation: check-draw 0.5s ease-out 0.3s forwards;
  stroke-dasharray: 50;
  stroke-dashoffset: 50;
}

@keyframes check-draw {
  to {
    stroke-dashoffset: 0;
  }
}

.bco-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--app-text);
  margin: 0;
}

.bco-subtitle {
  font-size: 0.875rem;
  color: var(--app-text-muted);
  margin: 0.5rem 0 0;
}

.bco-book-info {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--app-border);
  width: 100%;
}

.bco-book-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--app-text);
  margin: 0;
}

.bco-book-authors {
  font-size: 0.875rem;
  color: var(--app-text-muted);
  margin: 0.25rem 0 0;
}

.bco-close-btn {
  margin-top: 1.5rem;
  padding: 0.75rem 2rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  background: var(--app-primary);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.bco-close-btn:hover {
  background: var(--app-primary-strong);
}

.bco-close-btn:active {
  transform: scale(0.95);
}
</style>