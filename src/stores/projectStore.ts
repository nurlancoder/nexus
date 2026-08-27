import { create } from 'zustand'
import {
  projectApi,
  type ProjectDetail,
  type ProjectSummary,
} from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createWorkspaceLoader } from '@/lib/storeUtils'

interface ProjectState {
  summaries: ProjectSummary[]
  detail: ProjectDetail | null
  loading: boolean
  error: string
  loadSummaries: () => Promise<void>
  openProject: (name: string) => Promise<void>
  closeProject: () => void
  refreshDetail: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  summaries: [],
  detail: null,
  loading: false,
  error: '',

  loadSummaries: createWorkspaceLoader(
    (path) => projectApi.list(path),
    (summaries) => ({ summaries }),
  )(set),

  openProject: async (name) => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    set({ loading: true, error: '' })
    try {
      const detail = await projectApi.detail(ws.path, name)
      set({ detail, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  closeProject: () => set({ detail: null }),

  refreshDetail: async () => {
    const current = get().detail
    if (!current) return
    await get().openProject(current.name)
  },
}))
