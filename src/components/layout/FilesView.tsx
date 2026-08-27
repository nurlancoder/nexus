import { useWorkspaceStore } from '@/stores/workspaceStore'
import { refreshTree } from '@/features/notes/actions'
import { FileExplorer } from '@/features/workspace/FileExplorer'
import { EmptyStatePanel } from '@/components/ui/EmptyStatePanel'

export function FilesView() {
  const isDark = useWorkspaceStore((s) => s.theme === 'dark')
  const hasWorkspace = useWorkspaceStore((s) => Boolean(s.workspace))

  if (!hasWorkspace) {
    return <EmptyStatePanel icon="📁" heading="Open a workspace to browse files" />
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Files</span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          everything in your vault
        </span>
        <div className="flex-1" />
        <button
          onClick={() => void refreshTree()}
          className={`rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
            isDark
              ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
          }`}
        >
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <FileExplorer />
      </div>
    </div>
  )
}
