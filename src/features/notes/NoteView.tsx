import { useCallback, useEffect, useState } from 'react'
import { useNoteStore } from '@/stores/noteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { RichTextEditor } from '@/components/editor/RichTextEditor'

interface NoteViewProps {
  path: string
}

export function NoteView({ path }: NoteViewProps) {
  const doc = useNoteStore((s) => s.docs[path])
  const load = useNoteStore((s) => s.load)
  const setContent = useNoteStore((s) => s.setContent)
  const save = useNoteStore((s) => s.save)
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [savedAt, setSavedAt] = useState('')

  useEffect(() => {
    void load(path)
  }, [path, load])

  const doSave = useCallback(async () => {
    await save(path)
    setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  }, [path, save])

  useEffect(() => {
    if (!doc || doc.loading || doc.content === doc.saved) return
    const t = window.setTimeout(() => void doSave(), 900)
    return () => window.clearTimeout(t)
  }, [doc, doSave])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void doSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSave])

  if (!doc || doc.loading) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">
        Loading…
      </div>
    )
  }

  const dirty = doc.content !== doc.saved

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-10 shrink-0 items-center gap-3 border-b px-4 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">{doc.title}</span>
        {dirty && (
          <span
            className={`text-[11px] ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
          >
            ● Unsaved
          </span>
        )}
        {savedAt && (
          <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Saved {savedAt}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => void doSave()}
          className={`rounded-md px-2.5 py-1 text-[11px] ${
            isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
          }`}
        >
          Save
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <RichTextEditor
          initialContent={doc.content}
          onChange={(md) => setContent(path, md)}
        />
      </div>
    </div>
  )
}