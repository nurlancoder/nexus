import { describe, it, expect } from 'vitest'
import { basename, dirname, joinPath } from './paths'

describe('basename', () => {
  it('extracts the last segment for unix paths', () => {
    expect(basename('/ws/notes/a.md')).toBe('a.md')
    expect(basename('a.md')).toBe('a.md')
  })

  it('handles windows separators', () => {
    expect(basename('C:\\ws\\b.md')).toBe('b.md')
  })
})

describe('dirname', () => {
  it('strips the last segment', () => {
    expect(dirname('/ws/notes/a.md')).toBe('/ws/notes')
    expect(dirname('a.md')).toBe('/')
  })

  it('handles windows separators', () => {
    expect(dirname('C:\\ws\\a.md')).toBe('C:/ws')
  })
})

describe('joinPath', () => {
  it('joins with slashes outside Tauri', async () => {
    expect(await joinPath('/ws', 'notes', 'a.md')).toBe('/ws/notes/a.md')
    expect(await joinPath('a')).toBe('a')
  })
})
