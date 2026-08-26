import { create } from 'zustand'

interface CommandPaletteState {
  isOpen: boolean
  nonce: number
  open: () => void
  close: () => void
}

export const useCommandPaletteStore = create<CommandPaletteState>((set) => ({
  isOpen: false,
  nonce: 0,
  open: () => set((s) => ({ isOpen: true, nonce: s.nonce + 1 })),
  close: () => set({ isOpen: false }),
}))