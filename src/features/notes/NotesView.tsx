import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { refreshTree, createNoteInInbox } from '@/features/notes/actions'
import { flattenMdFiles } from '@/lib/fileTree'
import { EmptyStatePanel } from '@/components/ui/EmptyStatePanel'

export function NotesView() {
  const isDark = useWorkspaceStore((s) => s.theme === 'dark')
  const fileTree = useWorkspaceStore((s) => s.fileTree)
  const hasWorkspace = useWorkspaceStore((s) => Boolean(s.workspace))
  const openNote = useTabStore((s) => s.openNote)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void refreshTree()
  }, [])

  const items = useMemo(() => {
    const all = flattenMdFiles(fileTree)
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (f) => f.title.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    )
  }, [fileTree, query])

  if (!hasWorkspace) {
    return <EmptyStatePanel icon="📝" heading="Open a workspace to see your notes" />
  }

  const inputCls = `w-full rounded-md border px-2 py-1.5 text-[12px] outline-none transition-colors ${
    isDark
      ? 'border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder-zinc-500'
      : 'border-zinc-300 bg-white text-zinc-800 placeholder-zinc-400'
  }`

  const headerBtn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`

  const rowCls = isDark
    ? 'text-zinc-300 hover:bg-zinc-800/70'
    : 'text-zinc-700 hover:bg-zinc-200/70'

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Notes</span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {items.length} note{items.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => {
            setCreating(true)
            void createNoteInInbox().finally(() => setCreating(false))
          }}
          disabled={creating}
          className={headerBtn}
        >
          {creating ? 'Creating…' : 'New note'}
        </button>
      </div>

      <div className="shrink-0 p-3 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className={inputCls}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {items.length === 0 ? (
          <EmptyStatePanel icon="📝" heading="No notes found" />
        ) : (
          <div className="space-y-0.5">
            {items.map((f) => (
              <button
                key={f.path}
                onClick={() => openNote(f.path, f.title)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors ${rowCls}`}
              >
                <span className="shrink-0 text-[13px]">📝</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{f.name.replace(/\.(md|markdown|txt)$/i, '')}</span>
                  {f.dir && (
                    <span
                      className={`block truncate text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
                    >
                      {f.dir.replace(/^\//, '')}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
