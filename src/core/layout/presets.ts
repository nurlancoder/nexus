import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'

export type LayoutPreset = 'default' | 'writing' | 'research'

export interface LayoutFlags {
  sidebarVisible: boolean
  inspectorVisible: boolean
  focusMode: boolean
}

export function presetFlags(preset: LayoutPreset): LayoutFlags {
  switch (preset) {
    case 'writing':
      return { sidebarVisible: false, inspectorVisible: false, focusMode: true }
    case 'research':
    case 'default':
      return { sidebarVisible: true, inspectorVisible: true, focusMode: false }
  }
}

export function applyLayoutPreset(preset: LayoutPreset): void {
  const flags = presetFlags(preset)
  useWorkspaceStore.setState(flags)

  const tabs = useTabStore.getState()
  if (preset === 'research') {
    tabs.openView('search', 'Search')
    const searchId = 'view:search'
    const next = useTabStore.getState()
    if (next.activeTabId === searchId) {
      const other = next.tabs.find((t) => t.id !== searchId)
      if (other) next.activateTab(other.id)
    }
    useTabStore.getState().setSplit(searchId)
  } else {
    useTabStore.getState().setSplit(null)
  }
}
