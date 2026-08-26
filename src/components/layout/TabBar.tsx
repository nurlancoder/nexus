import { useEffect } from 'react'
import { useTabStore } from '@/stores/tabStore'
import { useNoteStore } from '@/stores/noteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

export function TabBar() {
  const { tabs, activeTabId, splitTabId, activateTab, closeTab, cycleTab, toggleSplitTab } =
    useTabStore()
  const docs = useNoteStore((s) => s.docs)
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'

  const isDirty = (tab: (typeof tabs)[number]) =>
    tab.kind === 'note' && tab.notePath
      ? docs[tab.notePath] && docs[tab.notePath].content !== docs[tab.notePath].saved
      : false

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault()
        cycleTab(e.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycleTab])

  if (tabs.length === 0) return null

  return (
    <div
      className={`flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b px-1.5 ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                closeTab(tab.id)
              }
            }}
            onClick={() => activateTab(tab.id)}
            onAuxClick={(e) => {
              if (e.button === 1) closeTab(tab.id)
            }}
            className={`group flex min-w-0 max-w-[180px] cursor-pointer items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-[12px] ${
              active
                ? isDark
                  ? 'border border-b-0 border-zinc-800 bg-zinc-950 text-zinc-100'
                  : 'border border-b-0 border-zinc-200 bg-white text-zinc-900'
                : isDark
                  ? 'text-zinc-500 hover:text-zinc-300'
                  : 'text-zinc-500 hover:text-zinc-800'
            }`}
            title={tab.title}
          >
            <span className="truncate">{tab.title}</span>
            {isDirty(tab) && (
              <span className={`shrink-0 text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                ●
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleSplitTab(tab.id)
              }}
              title={splitTabId === tab.id ? 'Remove from split' : 'Show in split pane'}
              aria-label={splitTabId === tab.id ? `Remove ${tab.title} from split` : `Show ${tab.title} in split pane`}
              aria-pressed={splitTabId === tab.id}
              className={`hidden shrink-0 rounded-sm px-1 text-[10px] group-hover:block ${
                splitTabId === tab.id
                  ? 'text-blue-500'
                  : isDark
                    ? 'text-zinc-500 hover:bg-zinc-700 hover:text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800'
              }`}
            >
              ⇥
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
              aria-label={`Close ${tab.title}`}
              className={`ml-0.5 hidden shrink-0 rounded-sm px-1 text-[10px] group-hover:block ${
                isDark
                  ? 'text-zinc-500 hover:bg-zinc-700 hover:text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800'
              }`}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}