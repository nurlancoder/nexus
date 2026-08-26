import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { ROUTES } from '@/app/routes'

interface EmptyStateProps {
  label: string
}

export function EmptyState({ label }: EmptyStateProps) {
  const activeView = useWorkspaceStore((s) => s.activeView)
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'
  const route = ROUTES.find((r) => r.id === activeView)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="text-5xl opacity-40">◇</div>
      <h2
        className={`text-xl font-semibold ${
          isDark ? 'text-zinc-200' : 'text-zinc-800'
        }`}
      >
        {label}
      </h2>
      <p className="max-w-sm text-[13px] text-zinc-500">
        This workspace is empty. The {route?.label.toLowerCase() ?? 'view'}{' '}
        engine is wired up and ready — features land in later phases.
      </p>
      <button
        onClick={() => useTabStore.getState().openView('settings', 'Settings')}
        className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-500"
      >
        Open settings
      </button>
    </div>
  )
}