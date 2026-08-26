import type { Theme } from '@/stores/workspaceStore'

export interface Palette {
  bg: string
  surface: string
  surface2: string
  border: string
  text: string
  textMuted: string
  hover: string
  active: string
  accent: string
  accentBg: string
}

export const palette: Record<Theme, Palette> = {
  dark: {
    bg: 'bg-zinc-900',
    surface: 'bg-zinc-900',
    surface2: 'bg-zinc-800',
    border: 'border-zinc-800',
    text: 'text-zinc-100',
    textMuted: 'text-zinc-400',
    hover: 'hover:bg-zinc-800',
    active: 'bg-zinc-800',
    accent: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
  },
  light: {
    bg: 'bg-zinc-50',
    surface: 'bg-white',
    surface2: 'bg-zinc-100',
    border: 'border-zinc-200',
    text: 'text-zinc-900',
    textMuted: 'text-zinc-500',
    hover: 'hover:bg-zinc-100',
    active: 'bg-zinc-100',
    accent: 'text-blue-600',
    accentBg: 'bg-blue-500/10',
  },
}