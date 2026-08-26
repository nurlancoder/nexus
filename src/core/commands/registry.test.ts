import { describe, it, expect, beforeEach } from 'vitest'
import { commands } from './registry'

describe('command registry', () => {
  beforeEach(() => {
    for (const c of commands.all()) commands.unregister(c.id)
  })

  const a = {
    id: 'test.a',
    title: 'Alpha action',
    category: 'Test',
    keywords: ['first'],
    run: () => {},
  }
  const b = {
    id: 'test.b',
    title: 'Beta action',
    category: 'Test',
    keywords: ['second', 'helper'],
    run: () => {},
  }

  it('registers and lists sorted by title', () => {
    commands.register(b)
    commands.register(a)
    expect(commands.all().map((c) => c.id)).toEqual(['test.a', 'test.b'])
  })

  it('re-registering an id replaces the command', () => {
    commands.register(a)
    const a2 = { ...a, title: 'Renamed' }
    commands.register(a2)
    expect(commands.all()).toHaveLength(1)
    expect(commands.all()[0].title).toBe('Renamed')
  })

  it('searches by title, category and keywords', () => {
    commands.register(a)
    commands.register(b)
    expect(commands.search('beta').map((c) => c.id)).toEqual(['test.b'])
    expect(commands.search('test').length).toBe(2) // category
    expect(commands.search('helper').map((c) => c.id)).toEqual(['test.b'])
    expect(commands.search('').length).toBe(2)
  })

  it('runs the registered callback', () => {
    let ran = false
    commands.register({ ...a, run: () => (ran = true) })
    commands.run('test.a')
    expect(ran).toBe(true)
  })

  it('run is a no-op for unknown ids', () => {
    expect(() => commands.run('nope.nope')).not.toThrow()
  })

  it('unregister removes a command', () => {
    commands.register(a)
    commands.unregister('test.a')
    expect(commands.all()).toHaveLength(0)
  })
})
