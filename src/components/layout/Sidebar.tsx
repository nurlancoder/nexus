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
  search: '🔍',
  settings: '⚙',
}

export function Sidebar() {
  const { theme, sidebarWidth, workspace } = useWorkspaceStore()
  const openView = useTabStore((s) => s.openView)
  const isDark = theme === 'dark'

  return (
    <aside
      style={{ width: sidebarWidth }}
      className={`flex shrink-0 flex-col border-r ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <nav className="flex-1 overflow-y-auto p-2">
        <p
          className={`px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest ${
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          {workspace ? workspace.name : 'Workspace'}
        </p>
        <ul className="space-y-0.5">
          {ROUTES.map((route) => (
            <li key={route.id}>
              <button
                onClick={() => openView(route.id, route.label)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                  isDark
                    ? 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                    : 'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900'
                }`}
              >
                <span className="w-4 text-center text-[12px]">
                  {icons[route.id]}
                </span>
                <span>{route.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {workspace && (
          <>
            <p
              className={`px-2 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-widest ${
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