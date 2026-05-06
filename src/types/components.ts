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

export interface PromptModalProps {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  cancelLabel: string
  value: string
  inputLabel?: string
  inputPlaceholder?: string
  inputType?: 'text' | 'number' | 'url'
  inputMin?: string
  loading?: boolean
}

export interface PromptModalEmits {
  (event: 'cancel'): void
  (event: 'confirm'): void
  (event: 'update:value', value: string): void
}
