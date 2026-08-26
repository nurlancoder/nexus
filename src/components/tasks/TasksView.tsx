import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useTaskStore } from '@/stores/taskStore'
import { groupTasks, filterTasks, sectionLabel, todayString } from '@/core/tasks/model'

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-500/15 text-red-500',
  medium: 'bg-amber-500/15 text-amber-500',
  low: 'bg-blue-500/15 text-blue-500',
}

export function TasksView() {
  const { theme } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const tasks = useTaskStore((s) => s.tasks)
  const loading = useTaskStore((s) => s.loading)
  const error = useTaskStore((s) => s.error)
  const isDark = theme === 'dark'

  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [priority, setPriority] = useState<string | null>(null)

  useEffect(() => {
    void useTaskStore.getState().load()
  }, [])

  const today = todayString()
  const visible = useMemo(
    () => filterTasks(tasks, { query, showDone, priority }),
    [tasks, query, showDone, priority],
  )
  const groups = useMemo(() => groupTasks(visible, today), [visible, today])
  const openCount = tasks.filter((t) => !t.done).length

  const inputCls = `rounded-md border px-2 py-1 text-[12px] outline-none ${
    isDark
      ? 'border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-500'
      : 'border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400'
  }`
  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Tasks</span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {openCount} open
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter tasks…"
          className={`${inputCls} ml-2 w-44`}
        />
        <select
          value={priority ?? ''}
          onChange={(e) => setPriority(e.target.value || null)}
          className={inputCls}
        >
          <option value="">Any priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={() => setShowDone((v) => !v)}
          className={`${btn} ${showDone ? 'ring-1 ring-blue-500/50' : ''}`}
        >
          {showDone ? '✓ ' : ''}Completed
        </button>
        <div className="flex-1" />
        <button onClick={() => void useTaskStore.getState().load()} className={btn}>
          Refresh
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {loading && (
          <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Scanning workspace…
          </p>
        )}
        {error && <p className="text-[13px] text-red-500">{error}</p>}
        {!loading && !error && visible.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="text-5xl opacity-40">☑</div>
            <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              No tasks found. Add `- [ ]` checkboxes to any note.
            </p>
          </div>
        )}
        {groups.map(([section, items]) => (
          <div key={section} className="mb-4">
            <div
              className={`sticky top-0 z-10 mb-1 py-1 text-[11px] font-semibold uppercase tracking-widest ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              {sectionLabel(section, today)}
              <span className="ml-1.5 font-normal normal-case tracking-normal">
                ({items.length})
              </span>
            </div>
            <div className="space-y-0.5">
              {items.map((t) => {
                const muted = isDark ? 'text-zinc-600' : 'text-zinc-400'
                const overdue = !t.done && t.due != null && t.due < today
                const dueStyle = t.done
                  ? muted
                  : overdue
                    ? 'text-red-500'
                    : t.due === today
                      ? 'text-amber-500'
                      : isDark
                        ? 'text-zinc-400'
                        : 'text-zinc-500'
                return (
                  <div
                    key={`${t.path}:${t.line}`}
                    onClick={() => openNote(t.path, t.noteTitle)}
                    className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors ${
                      isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        void useTaskStore.getState().toggle(t)
                      }}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none transition-colors ${
                        t.done
                          ? 'border-green-500 bg-green-500 text-white'
                          : isDark
                            ? 'border-zinc-600 hover:border-zinc-400'
                            : 'border-zinc-400 hover:border-zinc-600'
                      }`}
                      title={t.done ? 'Mark as open' : 'Mark as done'}
                    >
                      {t.done ? '✓' : ''}
                    </button>
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        t.done
                          ? isDark
                            ? 'text-zinc-500 line-through'
                            : 'text-zinc-400 line-through'
                          : isDark
                            ? 'text-zinc-200'
                            : 'text-zinc-800'
                      }`}
                    >
                      {t.text}
                    </span>
                    {t.priority && (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                          PRIORITY_STYLE[t.priority] ?? ''
                        }`}
                      >
                        {t.priority}
                      </span>
                    )}
                    {t.due && (
                      <span className={`shrink-0 text-[11px] tabular-nums ${dueStyle}`}>
                        📅 {t.due}
                      </span>
                    )}
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                          isDark
                            ? 'bg-zinc-800 text-zinc-400'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        #{tag}
                      </span>
                    ))}
                    <span
                      className={`hidden shrink-0 truncate text-[11px] group-hover:inline sm:inline ${
                        isDark ? 'text-zinc-600' : 'text-zinc-400'
                      }`}
                    >
                      {t.noteTitle}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
