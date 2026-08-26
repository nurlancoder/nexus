import { useEffect, useMemo, useRef, useState } from 'react'
import { commands } from '@/core/commands/registry'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'

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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onMouseDown={close}
    >
      <div
        key={nonce}
        onMouseDown={(e) => e.stopPropagation()}
        className={`nexus-fade-in w-[540px] overflow-hidden rounded-xl border shadow-2xl ${
          isDark
            ? 'border-zinc-700 bg-zinc-900'
            : 'border-zinc-200 bg-white'
        }`}
      >
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
          className={`w-full border-b px-4 py-3 text-sm outline-none ${
            isDark
              ? 'border-zinc-800 bg-transparent text-zinc-100 placeholder:text-zinc-500'
              : 'border-zinc-200 bg-transparent text-zinc-900 placeholder:text-zinc-400'
          }`}
        />
        <ul className="max-h-72 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li
              className={`px-3 py-2 text-[13px] ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              No commands found
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
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] ${
                  i === selected
                    ? isDark
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'bg-zinc-100 text-zinc-900'
                    : isDark
                      ? 'text-zinc-400'
                      : 'text-zinc-600'
                }`}
              >
                <span>{cmd.title}</span>
                <span
                  className={`text-[10px] uppercase tracking-wider ${
                    isDark ? 'text-zinc-600' : 'text-zinc-400'
                  }`}
                >
                  {cmd.category}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}