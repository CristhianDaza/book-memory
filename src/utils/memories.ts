import type { BookMemory, BookMemoryKind, FirestoreDateLike } from '../types/memories'

export const memoryKinds: BookMemoryKind[] = ['quote', 'idea', 'question', 'summary']

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function nextReviewDateForNewMemory(now = new Date()): Date {
  return addDays(now, 1)
}

export function nextReviewDateForRemembered(now = new Date()): Date {
  return addDays(now, 4)
}

export function nextReviewDateForForgotten(now = new Date()): Date {
  return addDays(now, 1)
}

export function normalizeMemoryTags(value: string | string[]): string[] {
  const rawTags = Array.isArray(value) ? value : value.split(',')
  const unique = new Set<string>()
  rawTags.forEach((tag) => {
    const normalized = tag.trim().toLowerCase()
    if (normalized) unique.add(normalized)
  })
  return Array.from(unique).slice(0, 12)
}

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === 'object' && 'toDate' in value) {
    const converted = (value as FirestoreDateLike).toDate()
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null
  }
  return null
}

export function isMemoryDue(memory: BookMemory, now = new Date()): boolean {
  const nextReviewAt = toDate(memory.nextReviewAt)
  if (!nextReviewAt) return true
  return nextReviewAt.getTime() <= now.getTime()
}

