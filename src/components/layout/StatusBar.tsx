import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useNoteStore } from '@/stores/noteStore'
import { useAppInfo } from '@/hooks/useAppInfo'

export function StatusBar() {
  const { theme } = useWorkspaceStore()
  const info = useAppInfo()
  const isDark = theme === 'dark'

  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const notePath = activeTab?.kind === 'note' ? activeTab.notePath : undefined
  const doc = useNoteStore((s) => (notePath ? s.docs[notePath] : undefined))
  const wordCount = doc ? doc.content.split(/\s+/).filter(Boolean).length : null

  return (
    <footer
      className={`flex h-6 shrink-0 items-center gap-4 border-t px-3 text-[10px] ${
        isDark
          ? 'border-zinc-800 bg-zinc-900 text-zinc-500'
          : 'border-zinc-200 bg-zinc-50 text-zinc-400'
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Local
      </span>
      {wordCount !== null && (
        <span>{wordCount.toLocaleString()} words</span>
      )}
      <span className="ml-auto">{info}</span>
    </footer>
  )
}