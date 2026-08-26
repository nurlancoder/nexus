import { create } from 'zustand'
import { historyApi, type VersionInfo } from '@/core/filesystem/api'

interface HistoryState {
  versions: VersionInfo[]
  selectedId: number | null
  preview: string | null
  loading: boolean
  error: string | null
  currentPath: string | null
  load: (path: string) => Promise<void>
  select: (id: number) => Promise<void>
  restore: (path: string, id: number) => Promise<boolean>
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  versions: [],
  selectedId: null,
  preview: null,
  loading: false,
  error: null,
  currentPath: null,

  load: async (path) => {
    set({ loading: true, error: null, currentPath: path })
    try {
      const versions = await historyApi.list(path)
      const keep = get().selectedId
      const stillThere = keep !== null && versions.some((v) => v.id === keep)
      set({
        versions,
        loading: false,
        selectedId: stillThere ? keep : null,
        preview: stillThere ? get().preview : null,
      })
    } catch (e) {
      set({ error: String(e), loading: false, versions: [] })
    }
  },

  select: async (id) => {
    if (get().selectedId === id) {
      set({ selectedId: null, preview: null })
      return
    }
    const path = get().currentPath
    if (!path) return
    try {
      const content = await historyApi.get(path, id)
      set({ selectedId: id, preview: content })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  restore: async (path, id) => {
    try {
      await historyApi.restore(path, id)
      await get().load(path)
      return true
    } catch (e) {
      set({ error: String(e) })
      return false
    }
  },
}))
