import { describe, it, expect } from 'vitest'
import { palette } from './palette'

describe('palette', () => {
  it('defines identical class slots for both themes', () => {
    expect(Object.keys(palette.dark).sort()).toEqual(
      Object.keys(palette.light).sort(),
    )
  })

  it('only contains non-empty tailwind class strings', () => {
    for (const theme of [palette.dark, palette.light]) {
      for (const [, value] of Object.entries(theme)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      }
    }
  })

  it('uses dark zinc variants only in the dark theme', () => {
    expect(palette.dark.surface).toContain('zinc-900')
    expect(palette.light.surface).toBe('bg-white')
  })
})
