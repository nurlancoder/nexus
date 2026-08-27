/**
 * Shared Tailwind style tokens used across view components.
 * Import these instead of re-defining the same class strings.
 */

export const btn = (isDark: boolean) =>
  `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`

export const mutedText = (isDark: boolean) =>
  isDark ? 'text-zinc-500' : 'text-zinc-400'

export const toolbar = (isDark: boolean) =>
  `flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
    isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
  }`

export const surfaceBg = (isDark: boolean) =>
  isDark ? 'bg-zinc-900' : 'bg-zinc-50'

export const border = (isDark: boolean) =>
  isDark ? 'border-zinc-800' : 'border-zinc-200'
