import { describe, it, expect } from 'vitest'
import { healthBucket, basename } from './model'

describe('healthBucket', () => {
  it('buckets scores into good/fair/poor', () => {
    expect(healthBucket(95, true).label).toBe('Good')
    expect(healthBucket(70, true).label).toBe('Good')
    expect(healthBucket(69, true).label).toBe('Fair')
    expect(healthBucket(40, false).label).toBe('Fair')
    expect(healthBucket(39, false).label).toBe('Poor')
    expect(healthBucket(0, true).label).toBe('Poor')
  })

  it('adapts classes to theme', () => {
    expect(healthBucket(90, true).className).toContain('emerald-400')
    expect(healthBucket(90, false).className).toContain('emerald-700')
  })
})

describe('basename', () => {
  it('extracts the last path segment', () => {
    expect(basename('/w/notes/a.md')).toBe('a.md')
    expect(basename('a.md')).toBe('a.md')
  })
})
