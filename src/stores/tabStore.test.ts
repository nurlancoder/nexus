import { describe, it, expect, beforeEach } from 'vitest'
import { useTabStore } from './tabStore'

function seedTabs() {
  useTabStore.setState({
    tabs: [
      { id: 'note:a', title: 'A', kind: 'note', notePath: '/a.md' },
      { id: 'note:b', title: 'B', kind: 'note', notePath: '/b.md' },
      { id: 'view:graph', title: 'Graph', kind: 'view', viewId: 'graph' },
    ],
    activeTabId: 'note:a',
    splitTabId: null,
    splitRatio: 0.5,
  })
}

describe('tabStore', () => {
  beforeEach(() => {
    seedTabs()
  })

  it('openNote dedupes by path and activates the existing tab', () => {
    const s = useTabStore.getState()
    s.openNote('/b.md', 'B2')
    expect(useTabStore.getState().tabs).toHaveLength(3)
    expect(useTabStore.getState().activeTabId).toBe('note:b')
  })

  it('openNote appends a new tab and activates it', () => {
    useTabStore.getState().openNote('/c.md', 'C')
    const ts = useTabStore.getState()
    expect(ts.tabs).toHaveLength(4)
    expect(ts.activeTabId).toBe('note:/c.md')
  })

  it('openView creates the view tab once', () => {
    useTabStore.getState().openView('search', 'Search')
    useTabStore.getState().openView('search', 'Search')
    const ts = useTabStore.getState()
    expect(ts.tabs.filter((t) => t.id === 'view:search')).toHaveLength(1)
    expect(ts.activeTabId).toBe('view:search')
  })

  it('closeTab activates a neighbor when closing the active tab', () => {
    useTabStore.getState().closeTab('note:a')
    const ts = useTabStore.getState()
    expect(ts.tabs.map((t) => t.id)).toEqual(['note:b', 'view:graph'])
    expect(ts.activeTabId).toBe('note:b')
  })

  it('closeTab clears the split pane when the split target closes', () => {
    useTabStore.setState({ splitTabId: 'note:a' })
    useTabStore.getState().closeTab('note:a')
    expect(useTabStore.getState().splitTabId).toBeNull()
  })

  it('closeTab keeps split when an unrelated tab closes', () => {
    useTabStore.setState({ splitTabId: 'note:b' })
    useTabStore.getState().closeTab('view:graph')
    expect(useTabStore.getState().splitTabId).toBe('note:b')
  })

  it('closeAll resets everything', () => {
    useTabStore.setState({ splitTabId: 'note:b' })
    useTabStore.getState().closeAll()
    const ts = useTabStore.getState()
    expect(ts.tabs).toHaveLength(0)
    expect(ts.activeTabId).toBeNull()
    expect(ts.splitTabId).toBeNull()
  })

  it('cycleTab wraps in both directions', () => {
    useTabStore.getState().cycleTab(-1)
    expect(useTabStore.getState().activeTabId).toBe('view:graph')
    useTabStore.getState().cycleTab(1)
    expect(useTabStore.getState().activeTabId).toBe('note:a')
  })

  it('updateNoteTab renames id, path and title, keeping activation', () => {
    useTabStore.setState({ activeTabId: 'note:a' })
    useTabStore.getState().updateNoteTab('/a.md', '/renamed.md', 'Renamed')
    const ts = useTabStore.getState()
    expect(ts.tabs.find((t) => t.notePath === '/renamed.md')?.title).toBe('Renamed')
    expect(ts.activeTabId).toBe('note:/renamed.md')
    expect(ts.tabs.some((t) => t.id === 'note:a')).toBe(false)
  })

  it('swapPanes exchanges active and split tabs', () => {
    useTabStore.setState({ splitTabId: 'note:b' })
    useTabStore.getState().swapPanes()
    const ts = useTabStore.getState()
    expect(ts.activeTabId).toBe('note:b')
    expect(ts.splitTabId).toBe('note:a')
  })
})
