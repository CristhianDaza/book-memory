export type NotificationType = 'success' | 'error' | 'info'

export interface AppNotification {
  id: string
  type: NotificationType
  message: string
}
