import { create } from 'zustand'
import { tagApi, type TagCount, type TagNote } from '@/core/filesystem/api'
import { createWorkspaceLoader } from '@/lib/storeUtils'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface TagState {
  tags: TagCount[]
  notes: TagNote[]
  loading: boolean
  notesLoading: boolean
  error: string
  selected: string | null
  load: () => Promise<void>
  select: (tag: string) => Promise<void>
  clear: () => void
}

export const useTagStore = create<TagState>((set) => ({
  tags: [],
  notes: [],
  loading: false,
  notesLoading: false,
  error: '',
  selected: null,

  load: createWorkspaceLoader<TagCount[]>(
    (path) => tagApi.list(path),
    (tags) => ({ tags }),
  )(set),

  select: async (tag) => {
    set({ selected: tag, notesLoading: true, error: '' })
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) {
      set({ notesLoading: false })
      return
    }
    try {
      const notes = await tagApi.notes(ws.path, tag)
      set({ notes, notesLoading: false })
    } catch (e) {
      set({ error: String(e), notesLoading: false })
    }
  },

  clear: () => set({ notes: [], selected: null }),
}))
