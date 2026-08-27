import { useEffect, useState } from 'react'
import { useTabStore, type Tab } from '@/stores/tabStore'
import { useNoteStore } from '@/stores/noteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface TabContextMenu {
  x: number
  y: number
  tab: Tab
}

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const splitTabId = useTabStore((s) => s.splitTabId)
  const activateTab = useTabStore((s) => s.activateTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const closeOthers = useTabStore((s) => s.closeOthers)
  const closeAll = useTabStore((s) => s.closeAll)
  const cycleTab = useTabStore((s) => s.cycleTab)
  const toggleSplitTab = useTabStore((s) => s.toggleSplitTab)
  const reopenLastClosed = useTabStore((s) => s.reopenLastClosed)
  const docs = useNoteStore((s) => s.docs)
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [ctxMenu, setCtxMenu] = useState<TabContextMenu | null>(null)

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

  useEffect(() => {
    const close = () => setCtxMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  if (tabs.length === 0) return null

  const tabIcon = (tab: (typeof tabs)[number]) => {
    if (tab.kind === 'note') return '📝'
    if (tab.kind === 'canvas') return '◇'
    return '◻'
  }

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
            onContextMenu={(e) => {
              e.preventDefault()
              setCtxMenu({ x: e.clientX, y: e.clientY, tab })
            }}
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
                  ? 'border border-b-0 border-zinc-800 bg-zinc-950 font-semibold text-zinc-100'
                  : 'border border-b-0 border-zinc-200 bg-white font-semibold text-zinc-900'
                : isDark
                  ? 'text-zinc-500 hover:text-zinc-300'
                  : 'text-zinc-500 hover:text-zinc-800'
            }`}
            style={active ? { borderBottom: isDark ? '2px solid #3b82f6' : '2px solid #3b82f6' } : undefined}
            title={tab.title}
          >
            <span className="text-[10px] shrink-0">{tabIcon(tab)}</span>
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
              className={`shrink-0 rounded-sm px-1 text-[10px] opacity-40 transition-opacity group-hover:opacity-100 ${
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
              className={`ml-0.5 shrink-0 rounded-sm px-1 text-[10px] opacity-40 transition-opacity group-hover:opacity-100 ${
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
      {ctxMenu && (
        <div
          className={`fixed z-50 min-w-40 rounded-xl border py-1 shadow-2xl backdrop-blur-sm ${
            isDark
              ? 'border-zinc-700 bg-zinc-900/95'
              : 'border-zinc-200 bg-white/95'
          }`}
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { closeTab(ctxMenu.tab.id); setCtxMenu(null) }}
            className={`block w-full px-3 py-1 text-left text-[12px] transition-colors ${
              isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Close
          </button>
          <button
            onClick={() => { closeOthers(ctxMenu.tab.id); setCtxMenu(null) }}
            className={`block w-full px-3 py-1 text-left text-[12px] transition-colors ${
              isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Close others
          </button>
          <button
            onClick={() => { closeAll(); setCtxMenu(null) }}
            className={`block w-full px-3 py-1 text-left text-[12px] transition-colors ${
              isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Close all
          </button>
          <div className={`my-1 h-px mx-2 ${isDark ? 'bg-zinc-700/60' : 'bg-zinc-200'}`} />
          <button
            onClick={() => { reopenLastClosed(); setCtxMenu(null) }}
            className={`block w-full px-3 py-1 text-left text-[12px] transition-colors ${
              isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            Reopen closed
          </button>
        </div>
      )}
    </div>
  )
}