import { describe, it, expect, beforeEach } from 'vitest'
import { presetFlags, applyLayoutPreset } from './presets'
import { useTabStore } from '@/stores/tabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

describe('presetFlags', () => {
  it('writing hides chrome and enables focus', () => {
    expect(presetFlags('writing')).toEqual({
      sidebarVisible: false,
      inspectorVisible: false,
      focusMode: true,
    })
  })

  it('research and default show full chrome without focus', () => {
    const expected = { sidebarVisible: true, inspectorVisible: true, focusMode: false }
    expect(presetFlags('research')).toEqual(expected)
    expect(presetFlags('default')).toEqual(expected)
  })
})

describe('tab split state', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: null, splitTabId: null })
  })

  function seedTabs() {
    useTabStore.setState({
      tabs: [
        { id: 'note:a', title: 'A', kind: 'note', notePath: '/a.md' },
        { id: 'note:b', title: 'B', kind: 'note', notePath: '/b.md' },
        { id: 'note:c', title: 'C', kind: 'note', notePath: '/c.md' },
      ],
      activeTabId: 'note:a',
    })
  }

  it('setSplit and toggleSplitTab', () => {
    seedTabs()
    useTabStore.getState().setSplit('note:b')
    expect(useTabStore.getState().splitTabId).toBe('note:b')
    useTabStore.getState().toggleSplitTab('note:b')
    expect(useTabStore.getState().splitTabId).toBeNull()
    useTabStore.getState().toggleSplitTab('note:b')
    expect(useTabStore.getState().splitTabId).toBe('note:b')
  })

  it('closing the split tab clears the pane', () => {
    seedTabs()
    useTabStore.getState().setSplit('note:c')
    useTabStore.getState().closeTab('note:c')
    expect(useTabStore.getState().splitTabId).toBeNull()
    expect(useTabStore.getState().activeTabId).toBe('note:a')
  })

  it('closing the active tab keeps split if different tab', () => {
    seedTabs()
    useTabStore.getState().setSplit('note:c')
    useTabStore.getState().closeTab('note:a')
    expect(useTabStore.getState().splitTabId).toBe('note:c')
    expect(useTabStore.getState().activeTabId).toBe('note:b')
  })

  it('swapPanes exchanges active and split', () => {
    seedTabs()
    useTabStore.getState().setSplit('note:c')
    useTabStore.getState().swapPanes()
    const s = useTabStore.getState()
    expect(s.activeTabId).toBe('note:c')
    expect(s.splitTabId).toBe('note:a')
  })

  it('swapPanes is a no-op without split', () => {
    seedTabs()
    useTabStore.getState().swapPanes()
    expect(useTabStore.getState().activeTabId).toBe('note:a')
    expect(useTabStore.getState().splitTabId).toBeNull()
  })

  it('setSplitRatio clamps to bounds', () => {
    useTabStore.getState().setSplitRatio(0.05)
    expect(useTabStore.getState().splitRatio).toBeLessThanOrEqual(0.2)
    useTabStore.getState().setSplitRatio(0.95)
    expect(useTabStore.getState().splitRatio).toBeGreaterThanOrEqual(0.8)
    useTabStore.getState().setSplitRatio(0.6)
    expect(useTabStore.getState().splitRatio).toBe(0.6)
  })
})

describe('applyLayoutPreset integration', () => {
  beforeEach(() => {
    useTabStore.setState({ tabs: [], activeTabId: null, splitTabId: null })
    useWorkspaceStore.setState({
      sidebarVisible: true,
      inspectorVisible: true,
      focusMode: false,
    })
  })

  it('writing preset enters focus mode', () => {
    applyLayoutPreset('writing')
    const ws = useWorkspaceStore.getState()
    expect(ws.focusMode).toBe(true)
    expect(ws.sidebarVisible).toBe(false)
    expect(ws.inspectorVisible).toBe(false)
    expect(useTabStore.getState().splitTabId).toBeNull()
  })

  it('research preset opens search in split', () => {
    useTabStore.setState({
      tabs: [{ id: 'note:a', title: 'A', kind: 'note', notePath: '/a.md' }],
      activeTabId: 'note:a',
    })
    applyLayoutPreset('research')
    const ts = useTabStore.getState()
    expect(ts.splitTabId).toBe('view:search')
    expect(ts.tabs.some((t) => t.id === 'view:search')).toBe(true)
    expect(ts.activeTabId).toBe('note:a')
  })

  it('default preset closes split and restores chrome', () => {
    useTabStore.setState({
      tabs: [{ id: 'view:search', title: 'Search', kind: 'view', viewId: 'search' }],
      activeTabId: 'view:search',
      splitTabId: 'view:search',
    })
    useWorkspaceStore.setState({ focusMode: true, sidebarVisible: false })
    applyLayoutPreset('default')
    const ws = useWorkspaceStore.getState()
    expect(ws.focusMode).toBe(false)
    expect(ws.sidebarVisible).toBe(true)
    expect(ws.inspectorVisible).toBe(true)
    expect(useTabStore.getState().splitTabId).toBeNull()
  })
})
