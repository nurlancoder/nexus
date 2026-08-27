import { ROUTES } from '@/app/routes'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { FileExplorer } from '@/features/workspace/FileExplorer'

const icons: Record<string, string> = {
  inbox: '📥',
  notes: '📝',
  projects: '📁',
  tasks: '✓',
  graph: '◉',
  canvas: '◇',
  calendar: '◫',
  databases: '▦',
  files: '📎',
  tags: '🏷',
  search: '🔍',
  settings: '⚙',
}

export function Sidebar() {
  const { theme, sidebarWidth, workspace } = useWorkspaceStore()
  const activeView = useWorkspaceStore((s) => s.activeView)
  const openView = useTabStore((s) => s.openView)
  const isDark = theme === 'dark'

  return (
    <aside
      style={{ width: sidebarWidth }}
      className={`flex shrink-0 flex-col border-r transition-panel ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2.5 ${
          isDark ? 'border-b border-zinc-800' : 'border-b border-zinc-200'
        }`}
      >
        <span className="text-sm">◈</span>
        <span
          className={`text-[13px] font-semibold ${
            isDark ? 'text-zinc-200' : 'text-zinc-800'
          }`}
        >
          {workspace ? workspace.name : 'Nexus'}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-0.5">
          {ROUTES.map((route) => {
            const isActive = activeView === route.id
            return (
              <li key={route.id}>
                <button
                  onClick={() => openView(route.id, route.label)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                    isActive
                      ? isDark
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-blue-50 text-blue-600'
                      : isDark
                        ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <span className="w-4 text-center text-[12px]">
                    {icons[route.id]}
                  </span>
                  <span>{route.label}</span>
                </button>
              </li>
            )
          })}
        </ul>

        {workspace && (
          <>
            <div
              className={`my-2 border-t ${
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              }`}
            />
            <p
              className={`px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              Files
            </p>
            <FileExplorer />
          </>
        )}
      </nav>
      <div
        className={`border-t p-2 text-[12px] ${
          isDark
            ? 'border-zinc-800 text-zinc-500'
            : 'border-zinc-200 text-zinc-400'
        }`}
      >
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest">
          Favorites
        </p>
        <p className="px-2 text-zinc-500 opacity-60 dark:text-zinc-600">
          No favorites yet
        </p>
      </div>
    </aside>
  )
}