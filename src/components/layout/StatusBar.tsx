import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAppInfo } from '@/hooks/useAppInfo'

export function StatusBar() {
  const { theme } = useWorkspaceStore()
  const info = useAppInfo()
  const isDark = theme === 'dark'

  return (
    <footer
      className={`flex h-6 shrink-0 items-center gap-4 border-t px-3 text-[11px] ${
        isDark
          ? 'border-zinc-800 bg-zinc-900 text-zinc-500'
          : 'border-zinc-200 bg-zinc-50 text-zinc-400'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Local workspace
      </span>
      <span className="ml-auto">Offline · No AI</span>
      <span>{info}</span>
    </footer>
  )
}