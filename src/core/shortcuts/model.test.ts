import { describe, it, expect } from 'vitest'
import { matchesShortcut, formatShortcut } from './model'

const ev = (over: Partial<{
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}> = {}) => ({
  key: 's',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...over,
})

describe('matchesShortcut', () => {
  const spec = { key: 's', mod: true }

  it('matches ctrl on non-mac and cmd on mac', () => {
    expect(matchesShortcut(ev({ ctrlKey: true }), spec, false)).toBe(true)
    expect(matchesShortcut(ev({ metaKey: true }), spec, true)).toBe(true)
  })

  it('rejects the wrong modifier', () => {
    expect(matchesShortcut(ev({ metaKey: true }), spec, false)).toBe(false)
    expect(matchesShortcut(ev({ ctrlKey: true }), spec, true)).toBe(false)
    expect(matchesShortcut(ev(), spec, false)).toBe(false)
  })

  it('is case-insensitive on keys', () => {
    expect(matchesShortcut(ev({ ctrlKey: true, key: 'S' }), spec, false)).toBe(true)
  })

  it('respects shift and alt exactly', () => {
    const s = { key: 'k', mod: true, shift: true } as const
    expect(
      matchesShortcut(ev({ key: 'k', ctrlKey: true, shiftKey: true }), s, false),
    ).toBe(true)
    expect(matchesShortcut(ev({ key: 'k', ctrlKey: true }), s, false)).toBe(false)
    expect(
      matchesShortcut(
        ev({ key: 'k', ctrlKey: true, shiftKey: true, altKey: true }),
        s,
        false,
      ),
    ).toBe(false)
  })

  it('plain key requires no modifiers', () => {
    expect(matchesShortcut(ev({ key: 'Escape' }), { key: 'Escape' }, false)).toBe(true)
    expect(
      matchesShortcut(ev({ key: 'Escape', ctrlKey: true }), { key: 'Escape' }, false),
    ).toBe(false)
  })
})

describe('formatShortcut', () => {
  it('formats mac style compactly', () => {
    expect(formatShortcut({ key: 's', mod: true }, true)).toBe('⌘S')
    expect(formatShortcut({ key: 'k', mod: true, shift: true }, true)).toBe('⌘⇧K')
  })

  it('formats windows/linux style with plus', () => {
    expect(formatShortcut({ key: 's', mod: true }, false)).toBe('Ctrl+S')
    expect(formatShortcut({ key: 'k', mod: true, shift: true }, false)).toBe('Ctrl+Shift+K')
  })
})
