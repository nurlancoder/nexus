import { describe, it, expect } from 'vitest'
import {
  MARKETPLACE_PLUGINS,
  catalogFileName,
  isCatalogInstalled,
} from './catalog'

describe('marketplace catalog', () => {
  it('offers at least one installable plugin', () => {
    expect(MARKETPLACE_PLUGINS.length).toBeGreaterThan(0)
  })

  it('has unique ids and valid .js file names', () => {
    const ids = MARKETPLACE_PLUGINS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const name of ids.map(catalogFileName)) {
      expect(name.endsWith('.js')).toBe(true)
    }
  })

  it('every plugin has metadata and non-empty source', () => {
    for (const p of MARKETPLACE_PLUGINS) {
      expect(p.title.trim().length).toBeGreaterThan(0)
      expect(p.author.trim().length).toBeGreaterThan(0)
      expect(p.version.trim().length).toBeGreaterThan(0)
      expect(p.description.trim().length).toBeGreaterThan(0)
      expect(p.source.trim().length).toBeGreaterThan(0)
    }
  })

  it('catalogFileName maps an id to its install file', () => {
    expect(catalogFileName('word-count')).toBe('word-count.js')
  })

  it('isCatalogInstalled checks status names against the install file', () => {
    expect(isCatalogInstalled(['word-count.js', 'hello.js'], 'word-count')).toBe(true)
    expect(isCatalogInstalled(['word-count.js'], 'date-stamp')).toBe(false)
  })
})
