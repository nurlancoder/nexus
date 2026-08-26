import { useEffect } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useInsightsStore } from '@/stores/insightsStore'
import { useTabStore } from '@/stores/tabStore'
import { healthBucket, basename } from '@/core/insights/model'

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: 'warn' | 'bad' | 'good'
}) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  const border =
    tone === 'bad'
      ? 'border-red-500/40'
      : tone === 'warn'
        ? 'border-amber-500/40'
        : tone === 'good'
          ? 'border-emerald-500/40'
          : isDark
            ? 'border-zinc-800'
            : 'border-zinc-200'
  return (
    <div className={`flex-1 rounded-lg border p-3 ${border}`}>
      <div className="text-[18px] font-semibold">{value}</div>
      <div className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</div>
    </div>
  )
}

function SectionCard({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  return (
    <div
      className={`rounded-lg border ${
        isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div
        className={`flex items-center justify-between border-b px-4 py-2.5 text-[12px] font-semibold ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <span>{title}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-normal ${
            isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {count}
        </span>
      </div>
      <div className="max-h-72 overflow-auto p-2">{children}</div>
    </div>
  )
}

export function InsightsView() {
  const { theme, workspace } = useWorkspaceStore()
  const report = useInsightsStore((s) => s.report)
  const loading = useInsightsStore((s) => s.loading)
  const error = useInsightsStore((s) => s.error)
  const isDark = theme === 'dark'

  useEffect(() => {
    const ws = useWorkspaceStore.getState().workspace
    if (ws) void useInsightsStore.getState().load(ws.path)
  }, [])

  const openPath = (path: string) => useTabStore.getState().openNote(path, basename(path))

  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Knowledge Insights</span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          vault health at a glance
        </span>
        <div className="flex-1" />
        <button
          onClick={() => workspace && void useInsightsStore.getState().load(workspace.path)}
          className={btn}
        >
          Refresh
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {loading && (
          <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Analyzing vault…
          </p>
        )}
        {error && <p className="text-[13px] text-red-500">{error}</p>}
        {!loading && !error && !report && (
          <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Open a workspace to analyze it.
          </p>
        )}
        {report && (
          <>
            <div className="flex gap-3">
              <StatCard label="Notes" value={report.totals.notes} />
              <StatCard
                label="Orphan notes"
                value={report.totals.orphans}
                tone={report.totals.orphans > 0 ? 'warn' : 'good'}
              />
              <StatCard
                label="Broken links"
                value={report.totals.brokenLinks}
                tone={report.totals.brokenLinks > 0 ? 'bad' : 'good'}
              />
              <StatCard
                label="Duplicate groups"
                value={report.totals.duplicateGroups}
                tone={report.totals.duplicateGroups > 0 ? 'warn' : 'good'}
              />
              <StatCard
                label="Avg health"
                value={`${report.totals.avgHealth}`}
                tone={
                  report.totals.avgHealth >= 70
                    ? 'good'
                    : report.totals.avgHealth >= 40
                      ? 'warn'
                      : 'bad'
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <SectionCard title="Orphan notes" count={report.orphans.length}>
                {report.orphans.length === 0 ? (
                  <p className={`px-2 py-1 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Every note is linked.
                  </p>
                ) : (
                  report.orphans.map((o) => (
                    <button
                      key={o.path}
                      onClick={() => openPath(o.path)}
                      className={`block w-full truncate rounded px-2 py-1.5 text-left text-[12px] ${
                        isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      🕸 {o.title}
                    </button>
                  ))
                )}
              </SectionCard>

              <SectionCard title="Broken links" count={report.brokenLinks.length}>
                {report.brokenLinks.length === 0 ? (
                  <p className={`px-2 py-1 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    No broken wiki links.
                  </p>
                ) : (
                  report.brokenLinks.map((b, i) => (
                    <button
                      key={`${b.sourcePath}:${b.target}:${i}`}
                      onClick={() => openPath(b.sourcePath)}
                      className={`block w-full truncate rounded px-2 py-1.5 text-left text-[12px] ${
                        isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span className="text-red-400">[[{b.target}]]</span>
                      <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>
                        {' '}
                        in {b.sourceTitle}
                      </span>
                    </button>
                  ))
                )}
              </SectionCard>

              <SectionCard title="Duplicate notes" count={report.duplicates.length}>
                {report.duplicates.length === 0 ? (
                  <p className={`px-2 py-1 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    No identical contents found.
                  </p>
                ) : (
                  report.duplicates.map((g, gi) => (
                    <div key={gi} className="px-2 py-1.5">
                      {g.paths.map((p) => (
                        <button
                          key={p}
                          onClick={() => openPath(p)}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[12px] ${
                            isDark
                              ? 'text-zinc-300 hover:bg-zinc-800'
                              : 'text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          ⧉ {basename(p)}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </SectionCard>

              <SectionCard title="Note health (worst first)" count={report.health.length}>
                {report.health.map((h) => {
                  const bucket = healthBucket(h.score, isDark)
                  return (
                    <button
                      key={h.path}
                      onClick={() => openPath(h.path)}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] ${
                        isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
                      }`}
                    >
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${bucket.className}`}
                      >
                        {h.score}
                      </span>
                      <span className="truncate">{h.title}</span>
                      <span className={`ml-auto shrink-0 text-[10px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {h.words}w · →{h.linksOut} ←{h.linksIn}
                      </span>
                    </button>
                  )
                })}
              </SectionCard>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
