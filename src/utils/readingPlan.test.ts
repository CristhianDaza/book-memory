import { describe, expect, it } from 'vitest'
import type { LibraryBook } from '../types/books'
import { createReadingPlanSnapshot, getReadingPlanInsights, getTodayReadingPlanQueue } from './readingPlan'

function book(overrides: Partial<LibraryBook> = {}): LibraryBook {
  return {
    id: 'book-1',
    source: 'manual',
    externalId: 'book-1',
    title: 'Book',
    authors: ['Author'],
    coverUrl: null,
    totalPages: 100,
    favorite: false,
    currentPage: 20,
    status: 'reading',
    completedAt: null,
    rating: null,
    note: null,
    readingPlan: null,
    ...overrides,
  }
}

describe('reading plan utilities', () => {
  const today = new Date('2026-05-13T10:00:00')

  it('returns no_plan when a book has no plan', () => {
    expect(getReadingPlanInsights(book(), today).status).toBe('no_plan')
  })

  it('calculates required daily pages from a target date', () => {
    const target = book({
      currentPage: 20,
      readingPlan: {
        targetDate: '2026-05-20',
        dailyPagesGoal: null,
        reminderEnabled: false,
        reminderTime: null,
        reminderDays: null,
        startDate: '2026-05-13',
        startPage: 20,
      },
    })

    const insights = getReadingPlanInsights(target, today)

    expect(insights.remainingPages).toBe(80)
    expect(insights.requiredDailyPages).toBe(10)
    expect(insights.status).toBe('on_track')
  })

  it('projects a finish date from a daily pages goal', () => {
    const target = book({
      currentPage: 40,
      readingPlan: {
        targetDate: null,
        dailyPagesGoal: 20,
        reminderEnabled: false,
        reminderTime: null,
        reminderDays: null,
        startDate: '2026-05-13',
        startPage: 40,
      },
    })

    expect(getReadingPlanInsights(target, today).projectedFinishDate).toBe('2026-05-16')
  })

  it('classifies books as behind and ahead using the plan baseline', () => {
    const behind = book({
      currentPage: 25,
      readingPlan: {
        targetDate: null,
        dailyPagesGoal: 10,
        reminderEnabled: false,
        reminderTime: null,
        reminderDays: null,
        startDate: '2026-05-10',
        startPage: 20,
      },
    })
    const ahead = book({
      currentPage: 60,
      readingPlan: {
        ...behind.readingPlan!,
        startDate: '2026-05-10',
        startPage: 20,
      },
    })

    expect(getReadingPlanInsights(behind, today).status).toBe('behind')
    expect(getReadingPlanInsights(ahead, today).status).toBe('ahead')
  })

  it('marks finished and abandoned books as non-active plan states', () => {
    const plan = createReadingPlanSnapshot(book(), {
      targetDate: '2026-05-20',
      dailyPagesGoal: 10,
      reminderEnabled: false,
      reminderTime: null,
      reminderDays: null,
    }, today)

    expect(getReadingPlanInsights(book({ status: 'finished', readingPlan: plan }), today).status).toBe('completed')
    expect(getReadingPlanInsights(book({ status: 'abandoned', readingPlan: plan }), today).status).toBe('inactive')
  })

  it('prioritizes today queue by behind, on track and ahead', () => {
    const entries = getTodayReadingPlanQueue([
      book({
        id: 'ahead',
        currentPage: 60,
        readingPlan: {
          targetDate: null,
          dailyPagesGoal: 10,
          reminderEnabled: false,
          reminderTime: null,
          reminderDays: null,
          startDate: '2026-05-10',
          startPage: 20,
        },
      }),
      book({
        id: 'behind',
        currentPage: 25,
        readingPlan: {
          targetDate: null,
          dailyPagesGoal: 10,
          reminderEnabled: false,
          reminderTime: null,
          reminderDays: null,
          startDate: '2026-05-10',
          startPage: 20,
        },
      }),
    ], today)

    expect(entries.map((entry) => entry.book.id)).toEqual(['behind', 'ahead'])
  })
})
