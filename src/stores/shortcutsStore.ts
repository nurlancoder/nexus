import { create } from 'zustand'

interface ShortcutsState {
  open: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

export const useShortcutsStore = create<ShortcutsState>((set) => ({
  open: false,
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
}))
