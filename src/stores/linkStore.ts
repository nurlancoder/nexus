import { create } from 'zustand'
import { linkingApi, type LinkResolution } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface LinkState {
  resolutions: Record<string, LinkResolution | undefined>
  loading: Record<string, boolean>
  resolve: (path: string) => Promise<void>
  invalidate: (path: string) => void
}

export const useLinkStore = create<LinkState>((set, get) => ({
  resolutions: {},
  loading: {},

  resolve: async (path) => {
    if (get().resolutions[path] || get().loading[path]) return
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
      delete resolutions[path]
      return { resolutions }
    }),
}))