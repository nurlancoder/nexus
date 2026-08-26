import { describe, it, expect } from 'vitest'
import { computeProgress, formatBytes } from './model'

describe('computeProgress', () => {
  it('returns 0 when no tasks', () => {
    expect(computeProgress(0, 0)).toBe(0)
  })

  it('computes rounded percentage', () => {
    expect(computeProgress(1, 3)).toBe(25)
    expect(computeProgress(2, 3)).toBe(40)
    expect(computeProgress(3, 0)).toBe(100)
    expect(computeProgress(0, 5)).toBe(0)
  })
})

describe('formatBytes', () => {
  it('formats bytes and kb', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats mb and gb', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe('3.5 GB')
  })
})
