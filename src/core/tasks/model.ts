import type { TaskItem } from '@/core/filesystem/api'

export interface TaskFilters {
  query: string
  showDone: boolean
  priority: string | null
}

export function todayString(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function filterTasks(tasks: TaskItem[], filters: TaskFilters): TaskItem[] {
  const q = filters.query.trim().toLowerCase()
  return tasks.filter((t) => {
    if (!filters.showDone && t.done) return false
    if (filters.priority && (t.priority ?? '') !== filters.priority) return false
    if (!q) return true
    return (
      t.text.toLowerCase().includes(q) ||
      t.noteTitle.toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    )
  })
}

export type TaskSection = 'overdue' | 'today' | 'upcoming' | 'noDate' | 'done'

export const TASK_SECTION_ORDER: TaskSection[] = [
  'overdue',
  'today',
  'upcoming',
  'noDate',
  'done',
]

export function sectionLabel(section: TaskSection, today: string): string {
  switch (section) {
    case 'overdue':
      return 'Overdue'
    case 'today':
      return `Today · ${today}`
    case 'upcoming':
      return 'Upcoming'
    case 'noDate':
      return 'No date'
    case 'done':
      return 'Completed'
  }
}

function bucketFor(task: TaskItem, today: string): TaskSection {
  if (task.done) return 'done'
  if (!task.due) return 'noDate'
  if (task.due < today) return 'overdue'
  if (task.due === today) return 'today'
  return 'upcoming'
}

const SECTION_WEIGHT: Record<TaskSection, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  noDate: 3,
  done: 4,
}

const PRIORITY_WEIGHT: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function sortWithinSections(tasks: TaskItem[], today: string): TaskItem[] {
  return [...tasks].sort((a, b) => {
    const w =
      SECTION_WEIGHT[bucketFor(a, today)] - SECTION_WEIGHT[bucketFor(b, today)]
    if (w !== 0) return w
    if (a.due && b.due && a.due !== b.due) {
      return a.due < b.due ? -1 : 1
    }
    const pa = PRIORITY_WEIGHT[a.priority ?? ''] ?? 3
    const pb = PRIORITY_WEIGHT[b.priority ?? ''] ?? 3
    if (pa !== pb) return pa - pb
    return a.text.toLowerCase().localeCompare(b.text.toLowerCase())
  })
}

export function groupTasks(
  tasks: TaskItem[],
  today: string,
): Array<[TaskSection, TaskItem[]]> {
  const sorted = sortWithinSections(tasks, today)
  const groups = new Map<TaskSection, TaskItem[]>()
  for (const t of sorted) {
    const bucket = bucketFor(t, today)
    const list = groups.get(bucket)
    if (list) list.push(t)
    else groups.set(bucket, [t])
  }
  return TASK_SECTION_ORDER.filter((s) => groups.has(s)).map(
    (s) => [s, groups.get(s)!] as [TaskSection, TaskItem[]],
  )
}
