import { useWorkspaceStore } from '@/stores/workspaceStore'

interface EmptyStatePanelProps {
  icon: string
  heading: string
  description?: string
}

/**
 * Consistent empty state panel used across all views.
 * Shows an emoji icon, heading text, and optional description.
 */
export function EmptyStatePanel({ icon, heading, description }: EmptyStatePanelProps) {
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="text-4xl opacity-40 select-none">{icon}</span>
      <p className={`text-[13px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
        {heading}
      </p>
      {description && (
        <p className={`max-w-xs text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {description}
        </p>
      )}
    </div>
  )
}
