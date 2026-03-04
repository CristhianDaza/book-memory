export interface AppLogRecord {
  kind: 'error' | 'unhandledrejection'
  message: string
  stack: string | null
  path: string | null
}
