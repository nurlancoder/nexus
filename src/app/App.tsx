import { useEffect } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useNoteStore } from '@/stores/noteStore'
import { useTabStore } from '@/stores/tabStore'
import { TitleBar } from '@/components/layout/TitleBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { MainArea } from '@/components/layout/MainArea'
import { Inspector } from '@/components/layout/Inspector'
import { StatusBar } from '@/components/layout/StatusBar'
import { CommandPalette } from '@/components/command/CommandPalette'
import { Resizer } from '@/components/ui/Resizer'
import { WelcomeScreen } from '@/features/workspace/WelcomeScreen'
import { registerCoreCommands } from '@/core/commands/core'
import { matchesShortcut } from '@/core/shortcuts/model'
import { createNoteInInbox } from '@/features/notes/actions'

registerCoreCommands()

export default function App() {
  const {
    theme,
    sidebarVisible,
    inspectorVisible,
    sidebarWidth,
    inspectorWidth,
    setSidebarWidth,
    setInspectorWidth,
    workspace,
    welcomeVisible,
    focusMode,
  } = useWorkspaceStore()
  const isDark = theme === 'dark'

  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useWorkspaceStore.getState().setFocusMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeTab = useTabStore
        .getState()
        .tabs.find((t) => t.id === useTabStore.getState().activeTabId)
      if (
        matchesShortcut(e, { key: 's', mod: true }, isMac) &&
        activeTab?.kind === 'note'
      ) {
        e.preventDefault()
        void useNoteStore.getState().save(activeTab.notePath!)
        return
      }
      if (matchesShortcut(e, { key: 'n', mod: true }, isMac)) {
        e.preventDefault()
        void createNoteInInbox()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMac])

  if (!workspace || welcomeVisible) {
    return (
      <div className={`h-full ${isDark ? 'dark' : ''}`}>
        <WelcomeScreen />
        <CommandPalette />
      </div>
    )
  }

  return (
    <div
      className={`flex h-full flex-col ${isDark ? 'dark' : ''} ${
        isDark ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        {sidebarVisible && !focusMode && (
          <>
            <Sidebar />
            <Resizer
              direction="vertical"
              value={sidebarWidth}
              onResize={setSidebarWidth}
            />
          </>
        )}
        <MainArea />
        {inspectorVisible && !focusMode && (
          <>
            <Resizer
              direction="vertical"
              value={inspectorWidth}
              onResize={setInspectorWidth}
              position="left"
            />
            <Inspector />
          </>
        )}
      </div>
      {!focusMode && <StatusBar />}
      {focusMode && (
        <button
          onClick={() => useWorkspaceStore.getState().setFocusMode(false)}
          className={`fixed bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] shadow-lg transition-opacity hover:opacity-100 ${
            isDark
              ? 'bg-zinc-800 text-zinc-400 opacity-60'
              : 'bg-white text-zinc-500 opacity-60 shadow-zinc-300'
          }`}
        >
          Focus mode · Esc to exit
        </button>
      )}
      <CommandPalette />
    </div>
  )
}