// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { findEmptyDays } from '@/lib/content-planning'

// ---------------------------------------------------------------------------
// Timezone-safe helpers
// All date construction mirrors findEmptyDays: new Date(y, m, d) → toISOString
// split on 'T' to get the local calendar date string. Parsing back with the
// same constructor keeps DOW checks consistent regardless of timezone.
// ---------------------------------------------------------------------------

/** Build ISO date string the same way findEmptyDays does (local calendar). */
function localDateStr(year: number, month: number, day: number): string {
  return new Date(year, month, day).toISOString().split('T')[0]
}

/** Count days in a month that fall on the given days-of-week, using local time. */
function countAllowedDays(year: number, month: number, postingDays: number[]): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const allowed = new Set(postingDays)
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    if (allowed.has(new Date(year, month, d).getDay())) count++
  }
  return count
}

// March 2026 reference (local calendar):
// Sun 1, Mon 2, Tue 3, Wed 4, Thu 5, Fri 6, Sat 7
// Sun 8, Mon 9, Tue 10, Wed 11, Thu 12, Fri 13, Sat 14
// Sun 15, Mon 16, Tue 17, Wed 18, Thu 19, Fri 20, Sat 21
// Sun 22, Mon 23, Tue 24, Wed 25, Thu 26, Fri 27, Sat 28
// Sun 29, Mon 30, Tue 31
// Weekdays (Mon-Fri): 22  |  Weekends: 9

describe('findEmptyDays — posting_days filter', () => {
  describe('default weekdays [1,2,3,4,5]', () => {
    it('returns only weekdays for a month with no posts', () => {
      const days = findEmptyDays(2026, 2, [])
      expect(days).toHaveLength(22) // 22 weekdays in March 2026
    })

    it('includes known Monday, excludes known Sunday and Saturday', () => {
      const days = findEmptyDays(2026, 2, [])
      expect(days).toContain(localDateStr(2026, 2, 2))  // Monday Mar 2
      expect(days).toContain(localDateStr(2026, 2, 6))  // Friday Mar 6
      expect(days).not.toContain(localDateStr(2026, 2, 1)) // Sunday Mar 1
      expect(days).not.toContain(localDateStr(2026, 2, 7)) // Saturday Mar 7
    })
  })

  describe('Mon/Wed/Fri only [1,3,5]', () => {
    it('returns only Mon/Wed/Fri days in March', () => {
      const days = findEmptyDays(2026, 2, [], [1, 3, 5])
      // Mon: 2,9,16,23,30 = 5 | Wed: 4,11,18,25 = 4 | Fri: 6,13,20,27 = 4 → 13 total
      expect(days).toHaveLength(13)
    })

    it('contains all expected Mon/Wed/Fri dates', () => {
      const days = findEmptyDays(2026, 2, [], [1, 3, 5])
      const mondays   = [2, 9, 16, 23, 30].map((d) => localDateStr(2026, 2, d))
      const wednesdays = [4, 11, 18, 25].map((d) => localDateStr(2026, 2, d))
      const fridays    = [6, 13, 20, 27].map((d) => localDateStr(2026, 2, d))
      for (const d of [...mondays, ...wednesdays, ...fridays]) {
        expect(days).toContain(d)
      }
    })

    it('excludes Tue/Thu/Sat/Sun dates', () => {
      const days = findEmptyDays(2026, 2, [], [1, 3, 5])
      expect(days).not.toContain(localDateStr(2026, 2, 3))  // Tuesday
      expect(days).not.toContain(localDateStr(2026, 2, 5))  // Thursday
      expect(days).not.toContain(localDateStr(2026, 2, 7))  // Saturday
      expect(days).not.toContain(localDateStr(2026, 2, 1))  // Sunday
    })

    it('integration: all returned days are known Mon/Wed/Fri local dates', () => {
      const days = findEmptyDays(2026, 2, [], [1, 3, 5])
      const allowed = new Set([
        ...([2, 9, 16, 23, 30].map((d) => localDateStr(2026, 2, d))),  // Mondays
        ...([4, 11, 18, 25].map((d) => localDateStr(2026, 2, d))),      // Wednesdays
        ...([6, 13, 20, 27].map((d) => localDateStr(2026, 2, d))),      // Fridays
      ])
      for (const d of days) {
        expect(allowed.has(d)).toBe(true)
      }
    })
  })

  describe('weekends only [0,6]', () => {
    it('returns only Sat/Sun days', () => {
      const days = findEmptyDays(2026, 2, [], [0, 6])
      // Sun: 1,8,15,22,29 = 5 | Sat: 7,14,21,28 = 4 → 9 total
      expect(days).toHaveLength(9)
    })

    it('all returned days are known Sat/Sun local dates', () => {
      const days = findEmptyDays(2026, 2, [], [0, 6])
      const allowed = new Set([
        ...([1, 8, 15, 22, 29].map((d) => localDateStr(2026, 2, d))),  // Sundays
        ...([7, 14, 21, 28].map((d) => localDateStr(2026, 2, d))),     // Saturdays
      ])
      for (const d of days) {
        expect(allowed.has(d)).toBe(true)
      }
    })
  })

  describe('all days [0,1,2,3,4,5,6]', () => {
    it('returns all 31 days of March when every dow is allowed', () => {
      const days = findEmptyDays(2026, 2, [], [0, 1, 2, 3, 4, 5, 6])
      expect(days).toHaveLength(31)
    })
  })

  describe('backward compatibility', () => {
    it('passing [0-6] returns more days than default weekdays-only', () => {
      const allDays = findEmptyDays(2026, 2, [], [0, 1, 2, 3, 4, 5, 6])
      const weekdaysOnly = findEmptyDays(2026, 2, [])
      expect(allDays).toHaveLength(31)
      expect(weekdaysOnly).toHaveLength(22)
      expect(weekdaysOnly.length).toBeLessThan(allDays.length)
    })
  })

  describe('scheduled dates interact correctly with posting_days filter', () => {
    it('a scheduled weekend day does not reduce the weekday count', () => {
      // Sunday Mar 1 — scheduling it should not affect weekday slots
      const scheduled = [new Date(2026, 2, 1, 9, 0, 0).toISOString()]
      const days = findEmptyDays(2026, 2, scheduled) // default weekdays
      // Sunday is already excluded by posting_days; scheduling it changes nothing
      expect(days).toHaveLength(22)
    })

    it('a scheduled Monday removes it from results', () => {
      // March 2 = Monday
      const scheduled = [new Date(2026, 2, 2, 9, 0, 0).toISOString()]
      const days = findEmptyDays(2026, 2, scheduled)
      expect(days).toHaveLength(21)
      expect(days).not.toContain(localDateStr(2026, 2, 2))
    })

    it('Mon/Wed/Fri filter: scheduling a Monday removes it from results', () => {
      // March 9 = Monday
      const scheduled = [new Date(2026, 2, 9, 9, 0, 0).toISOString()]
      const days = findEmptyDays(2026, 2, scheduled, [1, 3, 5])
      expect(days).toHaveLength(12) // 13 - 1
      expect(days).not.toContain(localDateStr(2026, 2, 9))
    })

    it('countAllowedDays matches findEmptyDays length when no days are scheduled', () => {
      for (const postingDays of [[1, 2, 3, 4, 5], [1, 3, 5], [0, 6], [0, 1, 2, 3, 4, 5, 6]]) {
        const days = findEmptyDays(2026, 2, [], postingDays)
        expect(days).toHaveLength(countAllowedDays(2026, 2, postingDays))
      }
    })
  })

  describe('empty / edge cases', () => {
    it('returns [] when posting_days is empty', () => {
      const days = findEmptyDays(2026, 2, [], [])
      expect(days).toHaveLength(0)
    })

    it('returns [] when all allowed weekdays are scheduled', () => {
      // Schedule all 22 weekdays in March 2026
      const allWeekdays = [2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 16, 17, 18, 19, 20,
        23, 24, 25, 26, 27, 30, 31].map((d) => new Date(2026, 2, d, 9, 0, 0).toISOString())
      const days = findEmptyDays(2026, 2, allWeekdays)
      expect(days).toHaveLength(0)
    })
  })
})
