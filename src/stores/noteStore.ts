import { create } from 'zustand'
import { noteApi } from '@/core/filesystem/api'
import {
  extractTitle,
  splitFrontmatter,
  joinFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
  type PropertyValue,
} from '@/core/parser/markdown'
import { basename } from '@/lib/paths'
import { useLinkStore } from '@/stores/linkStore'
import { pluginBus } from '@/core/plugins/bus'

export interface NoteDoc {
  path: string
  title: string
  frontmatter: string
  content: string
  saved: string
  loading: boolean
}

interface NoteState {
  docs: Record<string, NoteDoc>
  load: (path: string) => Promise<void>
  setContent: (path: string, content: string) => void
  setProperty: (path: string, key: string, value: PropertyValue | null) => Promise<void>
  save: (path: string) => Promise<void>
  close: (path: string) => void
  isDirty: (path: string) => boolean
}

export const useNoteStore = create<NoteState>((set, get) => ({
  docs: {},

  load: async (path) => {
    if (get().docs[path]?.loading) return
    set((s) => ({
      docs: {
        ...s.docs,
        [path]: {
          path,
          title: basename(path),
          frontmatter: '',
          content: '',
          saved: '',
          loading: true,
        },
      },
    }))
    try {
      const raw = await noteApi.read(path)
      const { frontmatter, body } = splitFrontmatter(raw)
      const title = extractTitle(raw, basename(path))
      set((s) => ({
        docs: {
          ...s.docs,
          [path]: {
            path,
            title,
            frontmatter,
            content: body,
            saved: body,
            loading: false,
          },
        },
      }))
    } catch {
      set((s) => ({
        docs: { ...s.docs, [path]: { ...s.docs[path], loading: false } },
      }))
    }
  },

  setContent: (path, content) =>
    set((s) => {
      if (!s.docs[path]) return s
      return { docs: { ...s.docs, [path]: { ...s.docs[path], content } } }
    }),

  setProperty: async (path, key, value) => {
    const doc = get().docs[path]
    if (!doc) return
    const fm = { ...parseFrontmatter(doc.frontmatter) }
    if (value === null) delete fm[key]
    else fm[key] = value
    const serialized = serializeFrontmatter(fm)
    const raw = serialized ? serialized + '\n' : ''
    set((s) => ({
      docs: {
        ...s.docs,
        [path]: {
          ...s.docs[path],
          frontmatter: raw,
          title:
            key === 'title' && typeof value === 'string'
              ? value
              : s.docs[path].title,
        },
      },
    }))
    await get().save(path)
  },

  save: async (path) => {
    const doc = get().docs[path]
    if (!doc) return
    const frontmatter = doc.frontmatter
    const contentAtWrite = doc.content
    const full = joinFrontmatter(frontmatter, contentAtWrite)
    try {
      await noteApi.write(path, full)
    } catch (e) {
      console.error('[nexus] save failed:', path, e)
      return
    }
    set((s) => {
      const current = s.docs[path]
      if (!current || current.content !== contentAtWrite) return s
      return {
        docs: { ...s.docs, [path]: { ...current, saved: contentAtWrite } },
      }
    })
    useLinkStore.getState().invalidate(path)
    pluginBus.emit('note:save', { path, title: doc.title })
  },

  close: (path) =>
    set((s) => {
      const docs = { ...s.docs }
      delete docs[path]
      return { docs }
    }),

  isDirty: (path) => {
    const d = get().docs[path]
    return d ? d.content !== d.saved : false
  },
}))