export interface ConfirmModalProps {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  loading?: boolean
  danger?: boolean
}

export interface ConfirmModalEmits {
  (event: 'cancel'): void
  (event: 'confirm'): void
}
