import { describe, it, expect, beforeEach } from 'vitest'
import { pluginKeybindings } from './keybindingRegistry'

const ev = (o: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    key: 'a',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...o,
  }) as KeyboardEvent

describe('pluginKeybindings registry', () => {
  beforeEach(() => {
    pluginKeybindings.clearAll()
  })

  it('starts empty', () => {
    expect(pluginKeybindings.all()).toEqual([])
    expect(pluginKeybindings.match(ev(), false)).toBeNull()
  })

  it('registers bindings keyed per plugin and id', () => {
    pluginKeybindings.register('alpha', { id: 'k1', key: 'j', mod: true }, 'plugin:alpha:jump')
    expect(pluginKeybindings.all()).toHaveLength(1)
    const [b] = pluginKeybindings.all()
    expect(b.plugin).toBe('alpha')
    expect(b.commandId).toBe('plugin:alpha:jump')
    expect(b.spec).toEqual({ key: 'j', mod: true, shift: false, alt: false })
  })

  it('matches a chord to the registered binding (ctrl on non-mac, meta on mac)', () => {
    pluginKeybindings.register('alpha', { id: 'k1', key: 'j', mod: true }, 'plugin:alpha:jump')
    expect(pluginKeybindings.match(ev({ key: 'j', ctrlKey: true }), false)?.commandId).toBe(
      'plugin:alpha:jump',
    )
    expect(pluginKeybindings.match(ev({ key: 'j', metaKey: true }), true)?.commandId).toBe(
      'plugin:alpha:jump',
    )
    expect(pluginKeybindings.match(ev({ key: 'j' }), false)).toBeNull()
  })

  it('first registered binding wins on ambiguous chords', () => {
    pluginKeybindings.register('alpha', { id: 'a', key: 'x', shift: true }, 'plugin:alpha:one')
    pluginKeybindings.register('beta', { id: 'b', key: 'x', shift: true }, 'plugin:beta:two')
    expect(pluginKeybindings.match(ev({ key: 'x', shiftKey: true }), false)?.commandId).toBe(
      'plugin:alpha:one',
    )
  })

  it('unregister removes a single binding', () => {
    pluginKeybindings.register('alpha', { id: 'a', key: 'x' }, 'c1')
    pluginKeybindings.register('alpha', { id: 'b', key: 'y' }, 'c2')
    pluginKeybindings.unregister('alpha', 'a')
    expect(pluginKeybindings.all()).toHaveLength(1)
    expect(pluginKeybindings.all()[0].id).toBe('b')
  })

  it('clearPlugin removes only that plugin bindings', () => {
    pluginKeybindings.register('alpha', { id: 'a', key: 'x' }, 'c1')
    pluginKeybindings.register('beta', { id: 'b', key: 'y' }, 'c2')
    pluginKeybindings.clearPlugin('alpha')
    expect(pluginKeybindings.all()).toHaveLength(1)
    expect(pluginKeybindings.all()[0].plugin).toBe('beta')
  })

  it('clearAll empties the registry', () => {
    pluginKeybindings.register('alpha', { id: 'a', key: 'x' }, 'c1')
    pluginKeybindings.clearAll()
    expect(pluginKeybindings.all()).toEqual([])
  })
})
