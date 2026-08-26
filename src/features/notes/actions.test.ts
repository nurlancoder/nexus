import { describe, it, expect, vi, beforeEach } from 'vitest'
import { noteApi, workspaceApi } from '@/core/filesystem/api'
import { createNoteInInbox, refreshTree } from './actions'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'

vi.mock('@/core/filesystem/api', () => ({
  workspaceApi: { tree: vi.fn() },
  noteApi: { create: vi.fn() },
}))

const mockedTree = vi.mocked(workspaceApi.tree)
const mockedCreate = vi.mocked(noteApi.create)

const WS = {
  id: 1,
  name: 'WS',
  path: '/ws',
  createdAt: '2026-01-01',
  lastOpenedAt: null,
}

describe('notes actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useWorkspaceStore.setState({ workspace: null, fileTree: [] })
    useTabStore.setState({ tabs: [], activeTabId: null })
  })

  it('refreshTree fetches and stores the file tree for the open workspace', async () => {
    const tree = [{ name: 'note.md', path: '/ws/note.md', isDir: false }]
    mockedTree.mockResolvedValue(tree as never)
    useWorkspaceStore.setState({ workspace: WS })

    await refreshTree()
    expect(mockedTree).toHaveBeenCalledWith('/ws')
    expect(useWorkspaceStore.getState().fileTree).toEqual(tree)
  })

  it('createNoteInInbox is a no-op without a workspace', async () => {
    const path = await createNoteInInbox()
    expect(path).toBeNull()
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('createNoteInInbox creates in Inbox, refreshes tree and opens a tab', async () => {
    useWorkspaceStore.setState({ workspace: WS })
    mockedCreate.mockResolvedValue('/ws/00-Inbox/Untitled.md')
    mockedTree.mockResolvedValue([])

    const path = await createNoteInInbox()
    expect(path).toBe('/ws/00-Inbox/Untitled.md')
    expect(mockedCreate).toHaveBeenCalledWith('/ws/00-Inbox', 'Untitled')
    expect(useWorkspaceStore.getState().fileTree).toEqual([])
    const ts = useTabStore.getState()
    expect(ts.activeTabId).toBe('note:/ws/00-Inbox/Untitled.md')
    expect(ts.tabs[0]?.title).toBe('Untitled')
  })
})
