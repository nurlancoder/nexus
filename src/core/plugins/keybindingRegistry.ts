import { matchesShortcut, type ShortcutSpec, type KeyEventLike } from '@/core/shortcuts/model'

export interface PluginKeybinding {
  plugin: string
  id: string
  commandId: string
  spec: ShortcutSpec
}

export interface KeybindingSpec {
  id: string
  key: string
  mod?: boolean
  shift?: boolean
  alt?: boolean
}

/**
 * Registry of keybindings contributed by plugins. Each binding maps an
 * input chord to a host command id (usually a `plugin:<plugin>:<id>` command).
 * A plugin may register several bindings; first-match-wins on dispatch so
 * plugins stay isolated from one another.
 */
class PluginKeybindingRegistry {
  private bindings = new Map<string, PluginKeybinding>()

  register(plugin: string, spec: KeybindingSpec, commandId: string): void {
    this.bindings.set(`${plugin}:${spec.id}`, {
      plugin,
      id: spec.id,
      commandId,
      spec: {
        key: spec.key,
        mod: spec.mod ?? false,
        shift: spec.shift ?? false,
        alt: spec.alt ?? false,
      },
    })
  }

  unregister(plugin: string, id: string): void {
    this.bindings.delete(`${plugin}:${id}`)
  }

  clearPlugin(plugin: string): void {
    for (const key of this.bindings.keys()) {
      if (key.startsWith(plugin + ':')) this.bindings.delete(key)
    }
  }

  clearAll(): void {
    this.bindings.clear()
  }

  all(): PluginKeybinding[] {
    return [...this.bindings.values()]
  }

  /** First registered binding whose spec matches the event wins. */
  match(e: KeyEventLike, isMac = false): PluginKeybinding | null {
    for (const b of this.bindings.values()) {
      if (matchesShortcut(e, b.spec, isMac)) return b
    }
    return null
  }
}

export const pluginKeybindings = new PluginKeybindingRegistry()
