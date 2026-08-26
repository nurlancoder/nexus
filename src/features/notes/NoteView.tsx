import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNoteStore } from '@/stores/noteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { parseFrontmatter } from '@/core/parser/markdown'
import { basename, dirname } from '@/lib/paths'

interface NoteViewProps {
  path: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved'

export function NoteView({ path }: NoteViewProps) {
  const doc = useNoteStore((s) => s.docs[path])
  const load = useNoteStore((s) => s.load)
  const setContent = useNoteStore((s) => s.setContent)
  const save = useNoteStore((s) => s.save)
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const tags = useMemo(() => {
    if (!doc || doc.loading) return []
    const fm = parseFrontmatter(doc.frontmatter)
    return Array.isArray(fm.tags) ? fm.tags : []
  }, [doc])

  const dirName = useMemo(() => {
    const d = dirname(path)
    return d === '.' || d === '/' ? '' : d
  }, [path])

  const fileName = useMemo(() => basename(path), [path])

  useEffect(() => {
    void load(path)
  }, [path, load])

  const doSave = useCallback(async () => {
    setSaveStatus('saving')
    await save(path)
    setSaveStatus('saved')
  }, [path, save])

  useEffect(() => {
    if (!doc || doc.loading || doc.content === doc.saved) return
    setSaveStatus('unsaved')
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
        <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
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
        {dirName && (
          <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {dirName} /
          </span>
        )}
        <span className="text-[13px] font-medium">{fileName}</span>
        {tags.length > 0 && (
          <div className="flex items-center gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <span
          className={`text-[11px] ${
            saveStatus === 'saving'
              ? isDark ? 'text-amber-400' : 'text-amber-600'
              : saveStatus === 'saved'
                ? isDark ? 'text-green-400' : 'text-green-600'
                : saveStatus === 'unsaved' || dirty
                  ? isDark ? 'text-amber-400' : 'text-amber-600'
                  : ''
          }`}
        >
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
          {(saveStatus === 'unsaved' || (saveStatus === 'idle' && dirty)) && '● Unsaved'}
        </span>
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