import { create } from 'zustand'
import { loadPlugins, setPluginDisabled, type PluginStatus } from '@/core/plugins/host'
import { useWorkspaceStore } from './workspaceStore'

interface PluginsState {
  statuses: PluginStatus[]
  loading: boolean
  reload: () => Promise<void>
  toggle: (name: string) => Promise<void>
}

export const usePluginStore = create<PluginsState>((set) => ({
  statuses: [],
  loading: false,

  reload: async () => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    set({ loading: true })
    try {
      const statuses = await loadPlugins(ws.path)
      set({ statuses, loading: false })
    } catch (e) {
      set({
        loading: false,
        statuses: [{ name: '(error)', enabled: false, error: String(e) }],
      })
    }
  },

  toggle: async (name) => {
    const current = usePluginStore
      .getState()
      .statuses.find((s) => s.name === name)
    if (!current) return
    setPluginDisabled(name, current.enabled)
    await usePluginStore.getState().reload()
  },
}))
