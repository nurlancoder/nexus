export interface NoteEventDetail {
  path: string
  title: string
  content?: string
}

export type PluginEventName = 'note:open' | 'note:save'
export type PluginEventHandler = (detail: NoteEventDetail) => void

const listeners = new Map<PluginEventName, Set<PluginEventHandler>>()

export const pluginBus = {
  emit(name: PluginEventName, detail: NoteEventDetail): void {
    const set = listeners.get(name)
    if (!set) return
    for (const handler of [...set]) {
      try {
        handler(detail)
      } catch {
        // a broken plugin must never break the app
      }
    }
  },
  on(name: PluginEventName, handler: PluginEventHandler): () => void {
    let set = listeners.get(name)
    if (!set) {
      set = new Set()
      listeners.set(name, set)
    }
    set.add(handler)
    return () => set.delete(handler)
  },
  clearAll(): void {
    listeners.clear()
  },
}
