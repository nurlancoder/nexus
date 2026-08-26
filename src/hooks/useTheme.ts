import { useWorkspaceStore } from '@/stores/workspaceStore'

export function useTheme() {
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'

  const bg = isDark ? 'bg-zinc-950' : 'bg-zinc-50'
  const surface = isDark ? 'bg-zinc-900' : 'bg-white'
  const surfaceHover = isDark ? 'bg-zinc-800' : 'bg-zinc-100'
  const surfaceActive = isDark ? 'bg-zinc-700' : 'bg-zinc-200'
  const border = isDark ? 'border-zinc-800' : 'border-zinc-200'
  const borderSubtle = isDark ? 'border-zinc-800/50' : 'border-zinc-200/50'
  const text = isDark ? 'text-zinc-100' : 'text-zinc-900'
  const textSecondary = isDark ? 'text-zinc-400' : 'text-zinc-500'
  const textTertiary = isDark ? 'text-zinc-500' : 'text-zinc-400'
  const ring = isDark ? 'ring-zinc-700' : 'ring-zinc-300'
  const shadow = isDark ? 'shadow-zinc-900/50' : 'shadow-zinc-200/50'
  const scrollbar = isDark ? 'scrollbar-dark' : 'scrollbar-light'

  return {
    theme,
    isDark,
    bg,
    surface,
    surfaceHover,
    surfaceActive,
    border,
    borderSubtle,
    text,
    textSecondary,
    textTertiary,
    ring,
    shadow,
    scrollbar,
  } as const
}
