import { create } from 'zustand'
import { attachmentApi, type AttachmentInfo } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { createWorkspaceLoader } from '@/lib/storeUtils'

interface AttachmentState {
  items: AttachmentInfo[]
  loading: boolean
  error: string
  selectedPath: string | null
  load: () => Promise<void>
  upload: (files: FileList | File[]) => Promise<number>
  select: (path: string | null) => void
  remove: (path: string) => Promise<void>
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result)
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export const useAttachmentStore = create<AttachmentState>((set, get) => ({
  items: [],
  loading: false,
  error: '',
  selectedPath: null,

  load: createWorkspaceLoader(
    (path) => attachmentApi.list(path),
    (items) => ({ items }),
  )(set),

  upload: async (files) => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return 0
    let saved = 0
    set({ error: '' })
    for (const file of Array.from(files)) {
      try {
        const data = await fileToBase64(file)
        await attachmentApi.save(ws.path, file.name, data)
        saved += 1
      } catch (e) {
        set({ error: `${file.name}: ${String(e)}` })
      }
    }
    if (saved > 0) await get().load()
    return saved
  },

  select: (selectedPath) => set({ selectedPath }),

  remove: async (path) => {
    try {
      await attachmentApi.delete(path)
    } catch {
      return
    }
    if (get().selectedPath === path) set({ selectedPath: null })
    await get().load()
  },
}))
