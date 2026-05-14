import { describe, expect, it } from 'vitest'
import type { LibraryBook, ReadingPlanDayRecord } from '../types/books'
import {
  buildReadingPlanDayRecord,
  createReadingPlanSnapshot,
  getAtRiskBookIds,
  getReadingPlanInsights,
  getTodayReadingPlanQueue,
  summarizeReadingPlanCompliance,
} from './readingPlan'

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

  it('builds a daily compliance record from sessions and target pages', () => {
    const plannedBook = book({
      readingPlan: {
        targetDate: null,
        dailyPagesGoal: 15,
        reminderEnabled: false,
        reminderTime: null,
        reminderDays: null,
        startDate: '2026-05-13',
        startPage: 20,
      },
    })

    const record = buildReadingPlanDayRecord(
      plannedBook,
      [
        { id: 's1', bookId: 'book-1', startedAt: new Date('2026-05-13T09:00:00'), pagesRead: 10 },
        { id: 's2', bookId: 'book-1', startedAt: new Date('2026-05-13T18:00:00'), pagesRead: 5 },
      ],
      today,
    )

    expect(record).toEqual({
      bookId: 'book-1',
      dayId: '2026-05-13',
      targetPages: 15,
      actualPages: 15,
      metGoal: true,
    })
  })

  it('summarizes adherence and detects at-risk books after two recent misses', () => {
    const plannedBook = book({
      id: 'risk-book',
      readingPlan: {
        targetDate: null,
        dailyPagesGoal: 10,
        reminderEnabled: false,
        reminderTime: null,
        reminderDays: null,
        startDate: '2026-05-11',
        startPage: 0,
      },
    })
    const records: ReadingPlanDayRecord[] = [
      {
        id: 'risk-book_2026-05-12',
        bookId: 'risk-book',
        dayId: '2026-05-12',
        targetPages: 10,
        actualPages: 0,
        metGoal: false,
      },
      {
        id: 'risk-book_2026-05-13',
        bookId: 'risk-book',
        dayId: '2026-05-13',
        targetPages: 10,
        actualPages: 8,
        metGoal: false,
      },
      {
        id: 'book-1_2026-05-13',
        bookId: 'book-1',
        dayId: '2026-05-13',
        targetPages: 10,
        actualPages: 10,
        metGoal: true,
      },
    ]

    const summary = summarizeReadingPlanCompliance(records, [plannedBook, book()], today)

    expect(summary.totalDays).toBe(3)
    expect(summary.metDays).toBe(1)
    expect(summary.adherencePercent).toBe(33)
    expect(getAtRiskBookIds(records, [plannedBook])).toEqual(['risk-book'])
    expect(summary.atRiskBookIds).toEqual(['risk-book'])
  })
})
