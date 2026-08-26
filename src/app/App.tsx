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
import { ToastProvider } from '@/components/ui/Toast'
import { ShortcutsHelp } from '@/components/ui/ShortcutsHelp'
import { useShortcutsStore } from '@/stores/shortcutsStore'
import { WelcomeScreen } from '@/features/workspace/WelcomeScreen'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
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
  const shortcutsOpen = useShortcutsStore((s) => s.open)
  const setShortcutsOpen = useShortcutsStore((s) => s.setOpen)

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
        return
      }
      if (matchesShortcut(e, { key: '\\', mod: true }, isMac)) {
        e.preventDefault()
        useWorkspaceStore.getState().toggleSidebar()
        return
      }
      if (matchesShortcut(e, { key: '\\', mod: true, shift: true }, isMac)) {
        e.preventDefault()
        useWorkspaceStore.getState().toggleInspector()
        return
      }
      if (matchesShortcut(e, { key: 'f', mod: true, shift: true }, isMac)) {
        e.preventDefault()
        useWorkspaceStore.getState().toggleFocusMode()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMac, setShortcutsOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'

      if (e.key === '?' && !isInput) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (matchesShortcut(e, { key: '/', mod: true }, isMac)) {
        e.preventDefault()
        useShortcutsStore.getState().toggle()
        return
      }
      if (matchesShortcut(e, { key: 'Tab' }, isMac) && e.ctrlKey) {
        e.preventDefault()
        if (e.shiftKey) {
          useTabStore.getState().cycleTab(-1)
        } else {
          useTabStore.getState().cycleTab(1)
        }
        return
      }
      if (matchesShortcut(e, { key: 'w', mod: true }, isMac)) {
        e.preventDefault()
        const { activeTabId } = useTabStore.getState()
        if (activeTabId) useTabStore.getState().closeTab(activeTabId)
        return
      }
      if (matchesShortcut(e, { key: 't', mod: true, shift: true }, isMac)) {
        e.preventDefault()
        useTabStore.getState().reopenLastClosed()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMac, setShortcutsOpen])

  if (!workspace || welcomeVisible) {
    return (
      <ToastProvider>
        <div className={`h-full ${isDark ? 'dark' : ''}`}>
          <WelcomeScreen />
          <CommandPalette />
          <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
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
                minSize={150}
                maxSize={400}
              />
            </>
          )}
          <ErrorBoundary label="Main area">
            <MainArea />
          </ErrorBoundary>
          {inspectorVisible && !focusMode && (
            <>
              <Resizer
                direction="vertical"
                value={inspectorWidth}
                onResize={setInspectorWidth}
                position="left"
                minSize={200}
                maxSize={450}
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
        <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      </div>
    </ToastProvider>
  )
}
