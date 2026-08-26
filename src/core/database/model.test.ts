import { describe, it, expect } from 'vitest'
import {
  matchesFilter,
  compareValues,
  sortRows,
  discoverColumns,
  visibleColumns,
} from './model'
import type { DatabaseRow } from '@/core/filesystem/api'

function row(
  path: string,
  title: string,
  properties: Record<string, string>,
): DatabaseRow {
  return { path, title, properties }
}

describe('matchesFilter', () => {
  const r = row('/a.md', 'A', { status: 'active', priority: '3' })

  it('passes when filter empty', () => {
    expect(matchesFilter(r)).toBe(true)
    expect(matchesFilter(r, 'status', '  ')).toBe(true)
    expect(matchesFilter(r, '', 'active')).toBe(true)
  })

  it('matches exact value case-insensitively', () => {
    expect(matchesFilter(r, 'status', 'active')).toBe(true)
    expect(matchesFilter(r, 'status', 'Active')).toBe(true)
    expect(matchesFilter(r, 'status', 'planning')).toBe(false)
  })

  it('supports comma-separated OR values', () => {
    expect(matchesFilter(r, 'status', 'planning, active')).toBe(true)
    expect(matchesFilter(r, 'status', 'planning,done')).toBe(false)
  })

  it('fails when property missing', () => {
    expect(matchesFilter(r, 'missing', 'x')).toBe(false)
  })
})

describe('compareValues', () => {
  it('compares numerically when both numeric', () => {
    expect(compareValues('9', '10')).toBeLessThan(0)
    expect(compareValues('3', '3')).toBe(0)
    expect(compareValues('5', '2')).toBeGreaterThan(0)
  })

  it('compares strings case-insensitively', () => {
    expect(compareValues('apple', 'Banana')).toBeLessThan(0)
    expect(compareValues('a', 'a')).toBe(0)
  })

  it('mixed types fall back to string compare', () => {
    expect(compareValues('10', 'abc')).toBeLessThan(0)
  })
})

describe('sortRows', () => {
  const rows = [
    row('/b.md', 'B', { priority: '10' }),
    row('/a.md', 'A', { priority: '9' }),
    row('/c.md', 'C', {}),
  ]

  it('sorts by title without sort key', () => {
    expect(sortRows(rows).map((r) => r.title)).toEqual(['A', 'B', 'C'])
  })

  it('sorts numerically by property ascending, missing values last', () => {
    expect(sortRows(rows, 'priority').map((r) => r.title)).toEqual(['A', 'B', 'C'])
  })

  it('reverses for descending but keeps missing values last', () => {
    expect(sortRows(rows, 'priority', 'desc').map((r) => r.title)).toEqual([
      'B',
      'A',
      'C',
    ])
  })

  it('keeps missing property last in both directions', () => {
    expect(sortRows(rows, 'priority', 'desc')[2].title).toBe('C')
  })

  it('does not mutate input', () => {
    const copy = [...rows]
    sortRows(rows, 'priority')
    expect(rows).toEqual(copy)
  })
})

describe('discoverColumns', () => {
  it('unions keys in order, skipping empty values', () => {
    const rows = [
      row('/a.md', 'A', { status: 'active' }),
      row('/b.md', 'B', { status: 'x', tags: 'a, b' }),
      row('/c.md', 'C', { empty: '' }),
    ]
    expect(discoverColumns(rows)).toEqual(['status', 'tags'])
  })

  it('includes extra seed columns first', () => {
    expect(discoverColumns([], ['title'])).toEqual(['title'])
  })
})

describe('visibleColumns', () => {
  const rows = [row('/a.md', 'A', { s: '1', t: '2', u: '3', v: '4', w: '5', x: '6', y: '7', z: '8', q: '9' })]

  it('uses selected columns when set', () => {
    expect(visibleColumns(rows, ['t'])).toEqual(['t'])
  })

  it('caps auto-discovered columns at 8', () => {
    expect(visibleColumns(rows, []).length).toBe(8)
  })
})
