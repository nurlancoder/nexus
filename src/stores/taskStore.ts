import { create } from 'zustand'
import { taskApi, type TaskItem } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'

interface TaskState {
  tasks: TaskItem[]
  loading: boolean
  error: string
  load: () => Promise<void>
  toggle: (task: TaskItem) => Promise<void>
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: '',

  load: async () => {
    const ws = useWorkspaceStore.getState().workspace
    if (!ws) return
    set({ loading: true, error: '' })
    try {
      const tasks = await taskApi.scan(ws.path)
      set({ tasks, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  toggle: async (task) => {
    const nextDone = !task.done
    set({
      tasks: get().tasks.map((t) =>
        t.path === task.path && t.line === task.line
          ? { ...t, done: nextDone }
          : t,
      ),
    })
    try {
      await taskApi.toggle(task.path, task.line, nextDone)
    } catch {
      set({
        tasks: get().tasks.map((t) =>
          t.path === task.path && t.line === task.line
            ? { ...t, done: !nextDone }
            : t,
        ),
      })
      return
    }
    await get().load()
  },
}))
