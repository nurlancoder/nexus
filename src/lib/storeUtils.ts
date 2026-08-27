import { useWorkspaceStore } from '@/stores/workspaceStore'

/**
 * Creates a workspace-bound loader for zustand stores.
 * Handles the common pattern: get workspace → set loading → call API → set result/error.
 */
export function createWorkspaceLoader<T>(
  apiFn: (wsPath: string) => Promise<T>,
  onSuccess: (result: T) => Record<string, unknown>,
): (set: (partial: Record<string, unknown>) => void) => () => Promise<void> {
  return (set) => async () => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    set({ loading: true, error: '' })
    try {
      const result = await apiFn(ws.path)
      set({ ...onSuccess(result), loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  }
}
