import { create } from 'zustand'
import { taskApi, type TaskItem } from '@/core/filesystem/api'
import { createWorkspaceLoader } from '@/lib/storeUtils'

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

  load: createWorkspaceLoader(
    (path) => taskApi.scan(path),
    (tasks) => ({ tasks }),
  )(set),

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
