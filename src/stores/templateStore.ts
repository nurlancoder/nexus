import { create } from 'zustand'
import { templateApi, type TemplateInfo } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface TemplateState {
  templates: TemplateInfo[]
  selectedName: string | null
  preview: string
  loading: boolean
  error: string
  load: () => Promise<void>
  select: (name: string) => Promise<void>
  createNote: (title: string, parentFolder?: string | null) => Promise<string | null>
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  selectedName: null,
  preview: '',
  loading: false,
  error: '',

  load: async () => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    set({ loading: true, error: '' })
    try {
      const templates = await templateApi.list(ws.path)
      const current = get().selectedName
      const next =
        current && templates.some((t) => t.name === current)
          ? current
          : (templates[0]?.name ?? null)
      set({ templates, selectedName: next, loading: false })
      if (next) await get().select(next)
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  select: async (name) => {
    set({ selectedName: name, preview: '' })
    const tpl = get().templates.find((t) => t.name === name)
    if (!tpl) return
    try {
      const preview = await templateApi.read(tpl.path)
      set({ preview })
    } catch (e) {
      set({ error: String(e) })
    }
  },

  createNote: async (title, parentFolder) => {
    const ws = useWorkspaceStore.getState().workspace
    const name = get().selectedName
    if (!ws || !name || !title.trim()) return null
    try {
      return await templateApi.createNote(ws.path, name, title.trim(), parentFolder ?? null)
    } catch (e) {
      set({ error: String(e) })
      return null
    }
  },
}))
