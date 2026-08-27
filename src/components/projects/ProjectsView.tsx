import { useEffect } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useProjectStore } from '@/stores/projectStore'
import { taskApi } from '@/core/filesystem/api'
import { computeProgress, formatBytes } from '@/core/projects/model'

function ProgressBar({
  done,
  open,
  isDark,
}: {
  done: number
  open: number
  isDark: boolean
}) {
  const pct = computeProgress(done, open)
  const mutedText = isDark ? 'text-zinc-500' : 'text-zinc-400'
  return (
    <div className="flex items-center gap-2">
      <div
        className={`h-1.5 flex-1 overflow-hidden rounded-full ${
          isDark ? 'bg-zinc-700' : 'bg-zinc-200'
        }`}
      >
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-9 shrink-0 text-right text-[11px] tabular-nums ${mutedText}`}>
        {pct}%
      </span>
    </div>
  )
}

export function ProjectsView() {
  const { theme } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const summaries = useProjectStore((s) => s.summaries)
  const detail = useProjectStore((s) => s.detail)
  const loading = useProjectStore((s) => s.loading)
  const error = useProjectStore((s) => s.error)
  const isDark = theme === 'dark'

  useEffect(() => {
    void useProjectStore.getState().loadSummaries()
  }, [])

  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`

  const backBtn = `rounded-md px-2.5 py-1.5 text-[12px] transition-all ${
    isDark
      ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      : 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
  }`

  const priorityBadge = (priority: string) => {
    const p = priority.toLowerCase()
    if (p === 'high') return 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
    if (p === 'medium' || p === 'med') return 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'
    return 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
  }

  const mutedText = isDark ? 'text-zinc-500' : 'text-zinc-400'
  const sectionTitle = `mb-2 text-[11px] font-semibold uppercase tracking-widest ${mutedText}`

  if (detail) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div
          className={`flex h-14 shrink-0 items-center gap-3 border-b px-4 ${
            isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
          }`}
        >
          <button onClick={() => useProjectStore.getState().closeProject()} className={backBtn}>
            ← Projects
          </button>
          <span className={`text-[15px] font-semibold ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{detail.name}</span>
          <div className="w-40">
            <ProgressBar
              done={detail.tasks.filter((t) => t.done).length}
              open={detail.tasks.filter((t) => !t.done).length}
              isDark={isDark}
            />
          </div>
          <div className="flex-1" />
          <button onClick={() => void useProjectStore.getState().refreshDetail()} className={btn}>
            Refresh
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-auto p-4">
          <section>
            <div className={sectionTitle}>
              Tasks ({detail.tasks.filter((t) => t.done).length}/{detail.tasks.length})
            </div>
            {detail.tasks.length === 0 && (
              <p className={`text-[12px] ${mutedText}`}>No tasks in this project yet.</p>
            )}
            <div className="space-y-0.5">
              {detail.tasks.map((t) => (
                <div
                  key={`${t.path}:${t.line}`}
                  onClick={() => openNote(t.path, t.noteTitle)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors ${
                    isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void taskApi
                        .toggle(t.path, t.line, !t.done)
                        .then(() => useProjectStore.getState().refreshDetail())
                    }}
                    title={t.done ? 'Mark as open' : 'Mark as done'}
                    aria-label={t.done ? 'Mark as open' : 'Mark as done'}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none ${
                      t.done
                        ? 'border-green-500 bg-green-500 text-white'
                        : isDark
                          ? 'border-zinc-600'
                          : 'border-zinc-400'
                    }`}
                  >
                    {t.done ? '✓' : ''}
                  </button>
                  <span
                    className={`truncate text-[13px] ${
                      t.done
                        ? `${mutedText} line-through`
                        : isDark
                          ? 'text-zinc-200'
                          : 'text-zinc-800'
                    }`}
                  >
                    {t.text}
                  </span>
                  {t.priority && (
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${priorityBadge(t.priority)}`}>
                      {t.priority}
                    </span>
                  )}
                  {t.due && (
                    <span className={`shrink-0 text-[11px] tabular-nums ${mutedText}`}>
                      📅 {t.due}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className={sectionTitle}>Notes ({detail.notes.length})</div>
            <div className="space-y-0.5">
              {detail.notes.map((n) => (
                <div
                  key={n.path}
                  onClick={() => openNote(n.path, n.title)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors ${
                    isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
                  }`}
                >
                  <span className={`text-[13px] ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                    {n.title}
                  </span>
                  <span className={`ml-auto shrink-0 text-[11px] tabular-nums ${mutedText}`}>
                    {n.updatedAt}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className={sectionTitle}>Resources ({detail.resources.length})</div>
            {detail.resources.length === 0 && (
              <p className={`text-[12px] ${mutedText}`}>No attachments or other files.</p>
            )}
            <div className="space-y-0.5">
              {detail.resources.map((r) => (
                <div
                  key={r.path}
                  title={r.path}
                  className={`flex items-center gap-2 rounded-md px-2 py-1 text-[13px] ${
                    isDark ? 'text-zinc-300' : 'text-zinc-700'
                  }`}
                >
                  <span>📎</span>
                  <span className="truncate">{r.name}</span>
                  <span className={`ml-auto shrink-0 text-[11px] ${mutedText}`}>
                    {formatBytes(r.size)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className={sectionTitle}>Timeline</div>
            <div className="space-y-1 border-l pl-3"
              style={{ borderColor: isDark ? '#3f3f46' : '#e4e4e7' }}
            >
              {detail.notes.map((n) => (
                <div key={n.path} className="relative flex items-center gap-2 text-[12px]">
                  <span
                    className={`absolute -left-[17px] h-1.5 w-1.5 rounded-full ${
                      isDark ? 'bg-zinc-600' : 'bg-zinc-300'
                    }`}
                  />
                  <span className={`w-24 shrink-0 tabular-nums ${mutedText}`}>
                    {n.updatedAt}
                  </span>
                  <button
                    onClick={() => openNote(n.path, n.title)}
                    className={`truncate text-left hover:underline ${
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    }`}
                  >
                    {n.title}
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Projects</span>
        <span className={`text-[11px] ${mutedText}`}>{summaries.length} in 02-Projects</span>
        <div className="flex-1" />
        <button onClick={() => void useProjectStore.getState().loadSummaries()} className={btn}>
          Refresh
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading && <p className={`text-[13px] ${mutedText}`}>Loading projects…</p>}
        {error && <p className="text-[13px] text-red-500">{error}</p>}
        {!loading && !error && summaries.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="text-5xl opacity-40">🗂</div>
            <p className={`max-w-xs text-[13px] ${mutedText}`}>
              No projects yet. Create a folder inside `02-Projects` and it will appear here.
            </p>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {summaries.map((p) => (
            <button
              key={p.path}
              onClick={() => void useProjectStore.getState().openProject(p.name)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                  : 'border-zinc-200 bg-white hover:border-zinc-400'
              }`}
            >
              <div className={`mb-2 truncate text-[14px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>
                {p.name}
              </div>
              <ProgressBar done={p.doneTasks} open={p.openTasks} isDark={isDark} />
              <div className={`mt-2 flex gap-3 text-[11px] ${mutedText}`}>
                <span>{p.openTasks} open</span>
                <span>{p.noteCount} notes</span>
              </div>
              {p.updatedAt && (
                <div className={`mt-1 text-[10px] ${mutedText}`}>Updated {p.updatedAt}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
