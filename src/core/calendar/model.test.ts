import { describe, it, expect } from 'vitest'
import {
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  toDateString,
  todayDateString,
} from './model'

describe('buildMonthGrid', () => {
  it('pads leading blanks and fills all days (Aug 2026 starts Saturday)', () => {
    const cells = buildMonthGrid(2026, 8)
    expect(cells).toHaveLength(42)
    const leads = cells.slice(0, 6).every((c) => c.date === null)
    expect(leads).toBe(true)
    expect(cells[6].date).toBe('2026-08-01')
    expect(cells[36].date).toBe('2026-08-31')
    expect(cells[37].date).toBeNull()
  })

  it('handles leap february', () => {
    const leap = buildMonthGrid(2024, 2)
    expect(leap.filter((c) => c.date !== null)).toHaveLength(29)
    const plain = buildMonthGrid(2023, 2)
    expect(plain.filter((c) => c.date !== null)).toHaveLength(28)
  })

  it('keeps exact weeks when month ends on saturday', () => {
    // Nov 2026: 30 days, Nov 1 is a Sunday → 30 + 5 trailing = 35
    const cells = buildMonthGrid(2026, 11)
    expect(cells).toHaveLength(35)
    expect(cells[0].date).toBe('2026-11-01')
    expect(cells[29].date).toBe('2026-11-30')
  })
})

describe('shiftMonth', () => {
  it('wraps across year boundaries', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth(2026, 8, 0)).toEqual({ year: 2026, month: 8 })
    expect(shiftMonth(2026, 8, -14)).toEqual({ year: 2025, month: 6 })
  })
})

describe('labels', () => {
  it('formats month label', () => {
    expect(monthLabel(2026, 8)).toBe('August 2026')
  })

  it('zero pads date strings', () => {
    expect(toDateString(2026, 3, 5)).toBe('2026-03-05')
    expect(todayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
