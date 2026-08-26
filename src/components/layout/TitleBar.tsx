import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'
import { createNoteInInbox } from '@/features/notes/actions'

export function TitleBar() {
  const { theme, toggleSidebar, toggleInspector, setTheme, sidebarVisible, inspectorVisible } =
    useWorkspaceStore()
  const isDark = theme === 'dark'
  const openPalette = useCommandPaletteStore((s) => s.open)

  const iconBtn = (active?: boolean) =>
    `rounded-md px-2 py-1 text-[12px] transition-colors ${
      active
        ? isDark
          ? 'bg-blue-900/30 text-blue-400'
          : 'bg-blue-100 text-blue-600'
        : isDark
          ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
          : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
    }`

  return (
    <header
      className={`flex h-11 items-center gap-2 border-b px-3 ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <span
        className={`text-sm font-semibold tracking-wide ${
          isDark ? 'text-zinc-200' : 'text-zinc-800'
        }`}
      >
        NEXUS
      </span>
      <div className="flex-1" />
      <button
        onClick={() => void createNoteInInbox()}
        className={`rounded-md px-3 py-1 text-[12px] transition-colors ${
          isDark
            ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            : 'bg-zinc-200 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-800'
        }`}
      >
        + New
      </button>
      <div
        className={`mx-1 h-4 w-px ${
          isDark ? 'bg-zinc-700' : 'bg-zinc-300'
        }`}
      />
      <button
        onClick={openPalette}
        className={`${iconBtn()} rounded-md border px-2.5 py-1 text-[12px] ${
          isDark ? 'border-zinc-700' : 'border-zinc-300'
        }`}
        title="Command palette"
        aria-label="Open command palette"
      >
        ⌘K
      </button>
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={iconBtn()}
        title="Toggle theme"
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? '☀' : '☾'}
      </button>
      <div
        className={`mx-1 h-4 w-px ${
          isDark ? 'bg-zinc-700' : 'bg-zinc-300'
        }`}
      />
      <button
        onClick={toggleSidebar}
        className={iconBtn(!sidebarVisible)}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
        aria-pressed={!sidebarVisible}
      >
        ◧
      </button>
      <button
        onClick={toggleInspector}
        className={iconBtn(!inspectorVisible)}
        title="Toggle inspector"
        aria-label="Toggle inspector"
        aria-pressed={!inspectorVisible}
      >
        ◨
      </button>
    </header>
  )
}