import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'

let lockCount = 0
let lockedScrollY = 0

function hasDOM(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function applyLock() {
  if (!hasDOM()) return
  lockedScrollY = window.scrollY
  const bodyStyle = document.body.style
  bodyStyle.position = 'fixed'
  bodyStyle.top = `-${lockedScrollY}px`
  bodyStyle.left = '0'
  bodyStyle.right = '0'
  bodyStyle.width = '100%'
  bodyStyle.overflow = 'hidden'
}

function releaseLock() {
  if (!hasDOM()) return
  const bodyStyle = document.body.style
  const scrollY = Math.max(lockedScrollY, 0)
  bodyStyle.position = ''
  bodyStyle.top = ''
  bodyStyle.left = ''
  bodyStyle.right = ''
  bodyStyle.width = ''
  bodyStyle.overflow = ''
  window.scrollTo(0, scrollY)
}

export function lockBodyScroll() {
  if (!hasDOM()) return
  lockCount += 1
  if (lockCount === 1) {
    applyLock()
  }
}

export function unlockBodyScroll() {
  if (!hasDOM()) return
  if (lockCount === 0) return
  lockCount -= 1
  if (lockCount === 0) {
    releaseLock()
  }
}

export function withBodyScrollLock(open: Ref<boolean> | ComputedRef<boolean>) {
  let isLockedByThisInstance = false
  watch(
    open,
    (isOpen) => {
      if (isOpen && !isLockedByThisInstance) {
        lockBodyScroll()
        isLockedByThisInstance = true
        return
      }
      if (!isOpen && isLockedByThisInstance) {
        unlockBodyScroll()
        isLockedByThisInstance = false
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (!isLockedByThisInstance) return
    unlockBodyScroll()
    isLockedByThisInstance = false
  })
}
