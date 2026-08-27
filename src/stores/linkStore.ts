import { create } from 'zustand'
import { linkingApi, type LinkResolution } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { pluginBus } from '@/core/plugins/bus'

interface LinkState {
  resolutions: Record<string, LinkResolution | undefined>
  loading: Record<string, boolean>
  resolve: (path: string, force?: boolean) => Promise<void>
  invalidate: (path: string) => void
  watch: () => () => void
}

export const useLinkStore = create<LinkState>((set, get) => ({
  resolutions: {},
  loading: {},

  resolve: async (path, force = false) => {
    if (get().loading[path]) return
    if (!force && get().resolutions[path]) return
    set((s) => ({ loading: { ...s.loading, [path]: true } }))
    try {
      const ws = useWorkspaceStore.getState().workspace
      if (!ws) return
      const res = await linkingApi.resolve(ws.path, path)
      set((s) => ({
        resolutions: { ...s.resolutions, [path]: res },
        loading: { ...s.loading, [path]: false },
      }))
    } catch {
      set((s) => ({ loading: { ...s.loading, [path]: false } }))
    }
  },

  invalidate: (path) =>
    set((s) => {
      const resolutions = { ...s.resolutions }
      const loading = { ...s.loading }
      delete resolutions[path]
      delete loading[path]
      return { resolutions, loading }
    }),

  watch: () =>
    pluginBus.on('note:save', ({ path: savedPath }) => {
      const state = get()
      if (state.resolutions[savedPath]) {
        void state.resolve(savedPath, true)
      }
      for (const openPath of Object.keys(state.resolutions)) {
        if (openPath !== savedPath) void state.resolve(openPath, true)
      }
    }),
}))