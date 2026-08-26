import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'

interface EmptyStateProps {
  label: string
}

const viewDescriptions: Record<string, string> = {
  inbox: 'Your inbox is empty. Capture ideas and quick notes here.',
  notes: 'No notes yet. Start writing to organize your thoughts.',
  projects: 'No projects created. Group related notes into projects.',
  tasks: 'No tasks found. Track your to-dos and action items.',
  graph: 'Open some notes to see their connections in the graph.',
  canvas: 'No canvases created. Draw freeform diagrams and mind maps.',
  calendar: 'No events scheduled. Plan your time with the calendar.',
  databases: 'No databases yet. Store structured data in tables.',
  attachments: 'No attachments. Attach files and media to your notes.',
  templates: 'No templates. Create reusable note templates.',
  plugins: 'No plugins installed. Extend Nexus with plugins.',
  files: 'No files to browse. Open a workspace folder first.',
  search: 'Start typing to search across all your notes.',
  settings: 'Configure your workspace settings here.',
  insights: 'Open notes to see writing insights and analytics.',
}

export function EmptyState({ label }: EmptyStateProps) {
  const activeView = useWorkspaceStore((s) => s.activeView)
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'

  const description =
    viewDescriptions[activeView] ??
    `The ${label.toLowerCase()} view is ready to use.`

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <svg
        width="80"
        height="80"
        viewBox="0 0 80 80"
        fill="none"
        className={`opacity-30 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
      >
        <rect x="16" y="8" width="48" height="64" rx="4" stroke="currentColor" strokeWidth="1.5" />
        <line x1="24" y1="20" x2="56" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="24" y1="30" x2="48" y2="30" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="24" y1="40" x2="52" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
        <line x1="24" y1="50" x2="40" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      </svg>
      <h2
        className={`text-xl font-semibold ${
          isDark ? 'text-zinc-200' : 'text-zinc-800'
        }`}
      >
        {label}
      </h2>
      <p className="max-w-sm text-[13px] text-zinc-500">{description}</p>
      <button
        onClick={() => useTabStore.getState().openView('settings', 'Settings')}
        className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-500 transition-colors"
      >
        Open Settings
      </button>
    </div>
  )
}