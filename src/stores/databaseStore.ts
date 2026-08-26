import { create } from 'zustand'
import { databaseApi, type DatabaseDefinition, type DatabaseMeta } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'

export function defaultDatabaseDefinition(): DatabaseDefinition {
  return {
    sourceFolders: [],
    filterKey: null,
    filterValue: null,
    columns: [],
    sortKey: null,
    sortDir: 'asc',
  }
}

interface DatabaseState {
  metas: DatabaseMeta[]
  activeName: string | null
  load: () => Promise<void>
  setActive: (name: string | null) => void
  create: (name: string) => Promise<void>
  remove: (name: string) => Promise<void>
  persistDefinition: (name: string, definition: DatabaseDefinition) => Promise<void>
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  metas: [],
  activeName: null,

  load: async () => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    try {
      const metas = await databaseApi.list(ws.path)
      const current = get().activeName
      const next =
        current && metas.some((m) => m.name === current)
          ? current
          : (metas[0]?.name ?? null)
      set({ metas, activeName: next })
    } catch (err) {
      console.error('[nexus] database load failed:', err)
      set({ metas: [] })
    }
  },

  setActive: (activeName) => set({ activeName }),

  create: async (name) => {
    const ws = useWorkspaceStore.getState().workspace
    const clean = name.trim()
    if (!ws || !clean) return
    await databaseApi.save(ws.path, clean, defaultDatabaseDefinition())
    set({ activeName: clean })
    await get().load()
  },

  remove: async (name) => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    try {
      await databaseApi.delete(ws.path, name)
    } catch {
      return
    }
    await get().load()
  },

  persistDefinition: async (name, definition) => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    try {
      await databaseApi.save(ws.path, name, definition)
    } catch (err) {
      console.error('[nexus] database save failed:', err)
    }
  },
}))
