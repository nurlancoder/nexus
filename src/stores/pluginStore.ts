import { create } from 'zustand'
import { loadPlugins, terminatePlugin, setPluginDisabled, type PluginStatus } from '@/core/plugins/host'
import { pluginApi } from '@/core/filesystem/api'
import { useWorkspaceStore } from './workspaceStore'

interface PluginsState {
  statuses: PluginStatus[]
  loading: boolean
  reload: () => Promise<void>
  toggle: (name: string) => Promise<void>
  terminate: (name: string) => void
  install: (name: string, source: string) => Promise<void>
  uninstall: (name: string) => Promise<void>
}

export const usePluginStore = create<PluginsState>((set, get) => ({
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

  terminate: (name) => {
    terminatePlugin(name)
    set({
      statuses: get().statuses.map((s) =>
        s.name === name ? { ...s, error: 'Terminated by user' } : s,
      ),
    })
  },

  install: async (name, source) => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    await pluginApi.install(ws.path, name, source)
    await usePluginStore.getState().reload()
  },

  uninstall: async (name) => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    await pluginApi.uninstall(ws.path, name)
    await usePluginStore.getState().reload()
  },
}))
