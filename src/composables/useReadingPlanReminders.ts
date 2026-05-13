import { getActivePinia, storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../stores/auth'
import { useBooksStore } from '../stores/books'
import { useNotificationsStore } from '../stores/notifications'
import { useSessionsStore } from '../stores/sessions'
import { getReadingPlanInsights, todayKey } from '../utils/readingPlan'

const COOLDOWN_PREFIX = 'book-memory-reading-plan-reminder'

function canUseStorage(): boolean {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
}

function hasSessionToday(bookId: string, sessions: Array<{ bookId: string; startedAt?: unknown }>, today: string): boolean {
  return sessions.some((session) => {
    if (session.bookId !== bookId || !session.startedAt) return false
    const startedAt =
      session.startedAt instanceof Date
        ? session.startedAt
        : typeof session.startedAt === 'object' && 'toDate' in session.startedAt
          ? (session.startedAt as { toDate: () => Date }).toDate()
          : null
    return startedAt ? todayKey(startedAt) === today : false
  })
}

function isReminderDue(reminderTime: string | null, now: Date): boolean {
  if (!reminderTime) return true
  const [hours, minutes] = reminderTime.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return true
  const dueAt = new Date(now)
  dueAt.setHours(hours, minutes, 0, 0)
  return now.getTime() >= dueAt.getTime()
}

export function useReadingPlanReminders() {
  if (!getActivePinia()) return
  const authStore = useAuthStore()
  const booksStore = useBooksStore()
  const sessionsStore = useSessionsStore()
  const notificationsStore = useNotificationsStore()
  const { isAuthenticated } = storeToRefs(authStore)
  const { library } = storeToRefs(booksStore)
  const { t } = useI18n()

  async function evaluateReminders() {
    if (!isAuthenticated.value) return
    await Promise.all([booksStore.ensureLibraryLoaded(), sessionsStore.ensureSessionsLoaded()])
    const now = new Date()
    const today = todayKey(now)
    const todayDay = now.getDay()

    for (const book of library.value) {
      const plan = book.readingPlan
      if (!plan?.reminderEnabled) continue
      if (plan.reminderDays?.length && !plan.reminderDays.includes(todayDay)) continue
      if (!isReminderDue(plan.reminderTime, now)) continue
      if (hasSessionToday(book.id, sessionsStore.allSessions, today)) continue
      const insights = getReadingPlanInsights(book, now)
      if (!['behind', 'on_track'].includes(insights.status)) continue

      const cooldownKey = `${COOLDOWN_PREFIX}:${book.id}:${today}`
      if (canUseStorage() && globalThis.localStorage.getItem(cooldownKey)) continue
      const pages = insights.requiredDailyPages ?? plan.dailyPagesGoal ?? 1
      const message = t('notifications.readingPlanReminder', { title: book.title, pages })

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(t('notifications.readingPlanReminderTitle'), { body: message })
      } else {
        notificationsStore.info(message, 6000)
      }
      if (canUseStorage()) {
        globalThis.localStorage.setItem(cooldownKey, '1')
      }
    }
  }

  watch(isAuthenticated, () => void evaluateReminders(), { immediate: true })
  watch(library, () => void evaluateReminders(), { deep: true })
}
