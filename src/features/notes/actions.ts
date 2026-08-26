import { noteApi, workspaceApi } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { joinPath } from '@/lib/paths'

export async function refreshTree() {
  const ws = useWorkspaceStore.getState().workspace
  if (!ws) return
  try {
    const tree = await workspaceApi.tree(ws.path)
    useWorkspaceStore.getState().setFileTree(tree)
  } catch (e) {
    console.error('[nexus] refreshTree failed:', e)
  }
}

export async function createNoteInInbox() {
  const ws = useWorkspaceStore.getState().workspace
  if (!ws) return null
  try {
    const inbox = await joinPath(ws.path, '00-Inbox')
    const path = await noteApi.create(inbox, 'Untitled')
    await refreshTree()
    useTabStore.getState().openNote(path, 'Untitled')
    return path
  } catch (e) {
    console.error('[nexus] createNoteInInbox failed:', e)
    return null
  }
}