import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { formatShortcut, type ShortcutSpec } from '@/core/shortcuts/model'

interface ShortcutEntry {
  spec: ShortcutSpec
  label: string
}

const categories: { title: string; shortcuts: ShortcutEntry[] }[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { spec: { key: 'k', mod: true }, label: 'Command palette' },
      { spec: { key: 'n', mod: true }, label: 'New note' },
      { spec: { key: 's', mod: true }, label: 'Save' },
    ],
  },
  {
    title: 'Editor',
    shortcuts: [
      { spec: { key: 'b', mod: true }, label: 'Bold' },
      { spec: { key: 'i', mod: true }, label: 'Italic' },
      { spec: { key: 'u', mod: true }, label: 'Underline' },
      { spec: { key: 'x', mod: true, shift: true }, label: 'Strikethrough' },
    ],
  },
  {
    title: 'Views',
    shortcuts: [
      { spec: { key: '\\', mod: true }, label: 'Toggle sidebar' },
      { spec: { key: '\\', mod: true, shift: true }, label: 'Toggle inspector' },
      { spec: { key: 'f', mod: true, shift: true }, label: 'Focus mode' },
    ],
  },
  {
    title: 'Layout',
    shortcuts: [
      { spec: { key: '1-9', mod: true }, label: 'Switch tabs' },
      { spec: { key: 'w', mod: true }, label: 'Close tab' },
      { spec: { key: 't', mod: true, shift: true }, label: 'Reopen tab' },
    ],
  },
  {
    title: 'System',
    shortcuts: [
      { spec: { key: '?' }, label: 'Show shortcuts' },
      { spec: { key: '/', mod: true }, label: 'Show shortcuts' },
    ],
  },
]

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, handleKey])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center nexus-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl nexus-fade-in dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="space-y-5">
          {categories.map((cat) => (
            <div key={cat.title}>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {cat.title}
              </h3>
              <div className="space-y-1">
                {cat.shortcuts.map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">
                      {s.label}
                    </span>
                    <kbd className="ml-4 rounded border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {formatShortcut(s.spec, isMac)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
