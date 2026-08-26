import { useEffect, useMemo, useRef, useState } from 'react'
import { commands } from '@/core/commands/registry'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'

const CATEGORY_STYLE: Record<string, string> = {
  View: 'bg-blue-500/15 text-blue-500',
  Workspace: 'bg-purple-500/15 text-purple-500',
  Layout: 'bg-emerald-500/15 text-emerald-500',
  System: 'bg-zinc-500/15 text-zinc-500',
  Note: 'bg-amber-500/15 text-amber-500',
  Task: 'bg-rose-500/15 text-rose-500',
  Project: 'bg-cyan-500/15 text-cyan-500',
}

const CATEGORY_ICON: Record<string, string> = {
  View: '◫',
  Workspace: '⊞',
  Layout: '⊞',
  System: '⚙',
  Note: '✎',
  Task: '☐',
  Project: '◰',
}

export function CommandPalette() {
  const { isOpen, nonce } = useCommandPaletteStore()
  const close = useCommandPaletteStore((s) => s.close)
  const theme = useWorkspaceStore((s) => s.theme)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const isDark = theme === 'dark'

  const results = useMemo(() => commands.search(query), [query])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen, nonce])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) close()
        else useCommandPaletteStore.getState().open()
      }
      if (e.key === 'Escape' && isOpen) close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh] nexus-fade-in"
      onMouseDown={close}
    >
      <div
        key={nonce}
        onMouseDown={(e) => e.stopPropagation()}
        className={`nexus-scale-in w-[540px] overflow-hidden rounded-xl border shadow-2xl ${
          isDark
            ? 'border-zinc-700 bg-zinc-900'
            : 'border-zinc-200 bg-white'
        }`}
      >
        <div className="flex items-center border-b px-4"
          style={{ borderColor: isDark ? 'rgb(39 39 42)' : 'rgb(228 228 231)' }}
        >
          <span className={`mr-2 text-[14px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelected(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelected((s) => Math.min(s + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelected((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter' && results[selected]) {
                results[selected].run()
                close()
              }
            }}
            placeholder="Search commands..."
            className={`flex-1 bg-transparent py-3 text-sm outline-none ${
              isDark
                ? 'text-zinc-100 placeholder:text-zinc-500'
                : 'text-zinc-900 placeholder:text-zinc-400'
            }`}
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="flex flex-col items-center gap-1 py-6 text-center">
              <span className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                No commands found
              </span>
              <span className={`text-[11px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                Try a different search term
              </span>
            </li>
          )}
          {results.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  cmd.run()
                  close()
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] ${
                  i === selected
                    ? isDark
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'bg-zinc-100 text-zinc-900'
                    : isDark
                      ? 'text-zinc-400'
                      : 'text-zinc-600'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] ${
                  CATEGORY_STYLE[cmd.category] ?? (isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500')
                }`}>
                  {CATEGORY_ICON[cmd.category] ?? '•'}
                </span>
                <span className="flex-1 text-left">{cmd.title}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    CATEGORY_STYLE[cmd.category] ?? (isDark ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-100 text-zinc-400')
                  }`}
                >
                  {cmd.category}
                </span>
                <span
                  className={`text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}
                >
                  ⌘K
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}