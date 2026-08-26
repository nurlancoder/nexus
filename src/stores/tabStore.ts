import { create } from 'zustand'
import type { ViewId } from '@/app/routes'
import { pluginBus } from '@/core/plugins/bus'

export interface Tab {
  id: string
  title: string
  kind: 'view' | 'note' | 'canvas'
  viewId?: ViewId
  notePath?: string
  canvasPath?: string
}

interface TabState {
  tabs: Tab[]
  activeTabId: string | null
  splitTabId: string | null
  splitRatio: number
  closedTabs: Tab[]
  openView: (viewId: ViewId, title: string) => void
  openNote: (path: string, title: string) => void
  openCanvas: (path: string, title: string) => void
  updateNoteTab: (oldPath: string, newPath: string, title: string) => void
  closeTab: (id: string) => void
  closeAll: () => void
  activateTab: (id: string) => void
  cycleTab: (dir: 1 | -1) => void
  reopenLastClosed: () => void
  setSplit: (id: string | null) => void
  toggleSplitTab: (id: string) => void
  swapPanes: () => void
  setSplitRatio: (ratio: number) => void
}

export const SPLIT_RATIO_MIN = 0.2
export const SPLIT_RATIO_MAX = 0.8

const storedSplitRatio = Number(localStorage.getItem('nexus.splitRatio')) || 0.5

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  splitTabId: null,
  splitRatio: Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, storedSplitRatio)),
  closedTabs: [],

  openView: (viewId, title) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.viewId === viewId)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const id = `view:${viewId}`
    const tab: Tab = { id, title, kind: 'view', viewId }
    set({ tabs: [...tabs, tab], activeTabId: id })
  },

  openNote: (path, title) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.notePath === path)
    if (existing) {
      set({ activeTabId: existing.id })
    } else {
      const id = `note:${path}`
      const tab: Tab = { id, title, kind: 'note', notePath: path }
      set({ tabs: [...tabs, tab], activeTabId: id })
    }
    pluginBus.emit('note:open', { path, title })
  },

  openCanvas: (path, title) => {
    const { tabs } = get()
    const existing = tabs.find((t) => t.canvasPath === path)
    if (existing) {
      set({ activeTabId: existing.id })
      return
    }
    const id = `canvas:${path}`
    const tab: Tab = { id, title, kind: 'canvas', canvasPath: path }
    set({ tabs: [...tabs, tab], activeTabId: id })
  },

  updateNoteTab: (oldPath, newPath, title) => {
    const newId = `note:${newPath}`
    set((s) => {
      let wasActive = false
      let wasSplit = false
      const tabs = s.tabs.map((t) => {
        if (t.kind !== 'note' || t.notePath !== oldPath) return t
        if (s.activeTabId === t.id) wasActive = true
        if (s.splitTabId === t.id) wasSplit = true
        return { ...t, id: newId, notePath: newPath, title }
      })
      const nextSplit = wasSplit ? newId : s.splitTabId
      return { tabs, activeTabId: wasActive ? newId : s.activeTabId, splitTabId: nextSplit }
    })
  },

  closeTab: (id) => {
    const { tabs, activeTabId, splitTabId, closedTabs } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    const closedTab = tabs[idx]
    const next = tabs.filter((t) => t.id !== id)
    const nextSplit = splitTabId === id ? null : splitTabId
    const nextClosed = [closedTab, ...closedTabs].slice(0, 20)
    if (activeTabId === id) {
      const neighbor = next[idx] ?? next[idx - 1]
      set({ tabs: next, activeTabId: neighbor?.id ?? null, splitTabId: nextSplit, closedTabs: nextClosed })
    } else {
      set({ tabs: next, splitTabId: nextSplit, closedTabs: nextClosed })
    }
  },

  closeAll: () =>
    set({ tabs: [], activeTabId: null, splitTabId: null }),

  activateTab: (id) => set({ activeTabId: id }),

  cycleTab: (dir) => {
    const { tabs, activeTabId } = get()
    if (tabs.length === 0) return
    const idx = tabs.findIndex((t) => t.id === activeTabId)
    const next = (idx + dir + tabs.length) % tabs.length
    set({ activeTabId: tabs[next].id })
  },

  reopenLastClosed: () => {
    const { closedTabs, tabs } = get()
    if (closedTabs.length === 0) return
    const [tab, ...rest] = closedTabs
    if (tabs.some((t) => t.id === tab.id)) {
      set({ closedTabs: rest, activeTabId: tab.id })
      return
    }
    set({ tabs: [...tabs, tab], activeTabId: tab.id, closedTabs: rest })
  },

  setSplit: (splitTabId) => set({ splitTabId }),

  toggleSplitTab: (id) => {
    const { splitTabId } = get()
    set({ splitTabId: splitTabId === id ? null : id })
  },

  swapPanes: () => {
    const { activeTabId, splitTabId } = get()
    if (!splitTabId || !activeTabId) return
    set({ activeTabId: splitTabId, splitTabId: activeTabId })
  },

  setSplitRatio: (ratio) => {
    const clamped = Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio))
    localStorage.setItem('nexus.splitRatio', String(clamped))
    set({ splitRatio: clamped })
  },
}))