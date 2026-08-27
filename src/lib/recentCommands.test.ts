import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadRecentCommands,
  recordRecentCommand,
  clearRecentCommands,
} from './recentCommands'

describe('recentCommands', () => {
  beforeEach(() => {
    clearRecentCommands()
  })

  it('starts empty', () => {
    expect(loadRecentCommands()).toEqual([])
  })

  it('records commands most-recent-first and dedupes', () => {
    recordRecentCommand('view.graph.open')
    recordRecentCommand('note.create')
    recordRecentCommand('view.graph.open')
    expect(loadRecentCommands()).toEqual([
      'view.graph.open',
      'note.create',
    ])
  })

  it('caps the history at five entries', () => {
    for (let i = 1; i <= 7; i++) recordRecentCommand(`cmd${i}`)
    const list = loadRecentCommands()
    expect(list).toHaveLength(5)
    expect(list[0]).toBe('cmd7')
    expect(list[4]).toBe('cmd3')
  })

  it('ignores malformed persisted payloads', () => {
    localStorage.setItem('nexus.recentCommands', 'not-json')
    expect(loadRecentCommands()).toEqual([])
    localStorage.setItem('nexus.recentCommands', JSON.stringify(['a', 42, 'b']))
    expect(loadRecentCommands()).toEqual(['a', 'b'])
  })

  it('clear empties the history', () => {
    recordRecentCommand('view.search.open')
    clearRecentCommands()
    expect(loadRecentCommands()).toEqual([])
  })
})
