import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { FileNode } from '@/types'

interface LinkState {
  query: string
  top: number
  left: number
  from: number
  to: number
}

function collectNotes(nodes: FileNode[], out: { name: string; path: string }[] = [], parentPath = ''): { name: string; path: string }[] {
  for (const n of nodes) {
    const fullPath = parentPath ? `${parentPath}/${n.name}` : n.name
    if (!n.isDir && /\.(md|markdown|txt)$/i.test(n.name)) {
      out.push({ name: n.name.replace(/\.(md|markdown|txt)$/i, ''), path: fullPath })
    }
    if (n.isDir) collectNotes(n.children, out, fullPath)
  }
  return out
}

export function LinkMenu({ editor }: { editor: Editor | null }) {
  const fileTree = useWorkspaceStore((s) => s.fileTree)
  const [state, setState] = useState<LinkState | null>(null)
  const [selected, setSelected] = useState(0)

  const notes = useMemo(() => collectNotes(fileTree), [fileTree])
  const filtered = useMemo(
    () =>
      state
        ? notes
            .filter((n) => n.name.toLowerCase().includes(state.query.toLowerCase()))
            .slice(0, 8)
        : [],
    [state, notes],
  )

  const complete = useCallback(
    (title: string) => {
      if (!editor || !state) return
      editor
        .chain()
        .focus()
        .deleteRange({ from: state.from, to: state.to })
        .insertContent(`[[${title}]]`)
        .run()
      setState(null)
    },
    [editor, state],
  )

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const { $from } = editor.state.selection
      if (!$from) return setState(null)
      const parent = $from.parent
      if (parent.type.name !== 'paragraph') return setState(null)
      const textBefore = parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
      const match = textBefore.match(/\[\[([^\]\n]*)$/)
      if (!match) return setState(null)
      const coords = editor.view.coordsAtPos($from.pos)
      setState({
        query: match[1],
        top: coords.top,
        left: coords.left,
        from: $from.pos - match[1].length - 2,
        to: $from.pos,
      })
    }
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  useEffect(() => {
    if (!state || filtered.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => (s + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => (s - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const t = filtered[selected]
        if (t) complete(t.name)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setState(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, filtered, selected, complete])

  if (!state) return null

  return (
    <div
      className="fixed z-40 max-h-64 w-64 overflow-y-auto rounded-lg border bg-white p-1 shadow-xl nexus-fade-in dark:border-zinc-700 dark:bg-zinc-900"
      style={{ top: state.top + 24, left: Math.max(12, state.left) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.length === 0 ? (
        <div className="px-3 py-4 text-center text-[12px] text-zinc-400 dark:text-zinc-500">
          No matching notes
        </div>
      ) : (
        filtered.map((note, i) => (
          <button
            key={note.name}
            onMouseEnter={() => setSelected(i)}
            onClick={() => complete(note.name)}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] ${
              i === selected
                ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                : 'text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span className="text-[12px]">📄</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{note.name}</div>
              {note.path !== note.name && (
                <div className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                  {note.path}
                </div>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  )
}