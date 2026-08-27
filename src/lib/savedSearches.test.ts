import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSavedSearches,
  saveSearch,
  renameSavedSearch,
  deleteSavedSearch,
  clearSavedSearches,
} from './savedSearches'

const KEY = 'nexus.savedSearches'

describe('savedSearches', () => {
  beforeEach(() => {
    clearSavedSearches()
  })

  it('starts empty', () => {
    expect(loadSavedSearches()).toEqual([])
  })

  it('saves searches most-recent-first', () => {
    saveSearch('Notes', 'note')
    saveSearch('Task', 'task')
    expect(loadSavedSearches()).toEqual([
      { name: 'Task', query: 'task' },
      { name: 'Notes', query: 'note' },
    ])
  })

  it('defaults the name to the query when name is empty', () => {
    saveSearch('', 'react')
    expect(loadSavedSearches()[0]).toEqual({ name: 'react', query: 'react' })
  })

  it('dedupes by query, bumping to the front and updating the name', () => {
    saveSearch('First', 'hooks')
    saveSearch('Other', 'state')
    saveSearch('Renamed', 'hooks')
    const list = loadSavedSearches()
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual({ name: 'Renamed', query: 'hooks' })
  })

  it('ignores an empty query', () => {
    saveSearch('x', '   ')
    expect(loadSavedSearches()).toEqual([])
  })

  it('caps the list at fifty entries', () => {
    for (let i = 1; i <= 55; i++) saveSearch(`name${i}`, `query${i}`)
    const list = loadSavedSearches()
    expect(list).toHaveLength(50)
    expect(list[0].query).toBe('query55')
  })

  it('renames an entry, falling back to the query when blank', () => {
    saveSearch('A', 'alpha')
    saveSearch('B', 'beta')
    renameSavedSearch(0, 'Bravo')
    expect(loadSavedSearches()[0].name).toBe('Bravo')
    renameSavedSearch(0, '   ')
    expect(loadSavedSearches()[0].name).toBe('beta')
  })

  it('deletes entries by index and clamps out-of-range', () => {
    saveSearch('A', 'a')
    saveSearch('B', 'b')
    saveSearch('C', 'c')
    deleteSavedSearch(1)
    expect(loadSavedSearches().map((s) => s.query)).toEqual(['c', 'a'])
    deleteSavedSearch(99)
    expect(loadSavedSearches()).toHaveLength(2)
  })

  it('resilient to malformed persisted payloads', () => {
    localStorage.setItem(KEY, 'not-json')
    expect(loadSavedSearches()).toEqual([])
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { name: 'Ok', query: 'ok' },
        { name: 'MissingQuery' },
        42,
        'junk',
        null,
      ]),
    )
    expect(loadSavedSearches()).toEqual([{ name: 'Ok', query: 'ok' }])
  })

  it('clear empties the saved list', () => {
    saveSearch('A', 'a')
    clearSavedSearches()
    expect(loadSavedSearches()).toEqual([])
  })
})
