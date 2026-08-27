import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { usePluginStore } from '@/stores/pluginStore'
import { EmptyStatePanel } from '@/components/ui/EmptyStatePanel'

const API_DOCS = [
  'nx.registerCommand({ id, title, run }) — command palette entry',
  "nx.on('note:open' | 'note:save', handler) — lifecycle events",
  'nx.getActiveNote() / nx.readNote(path) / nx.writeNote(path, content)',
  'nx.log(message) / nx.today()',
]

function PluginCard({ s, isDark }: { s: { name: string; enabled: boolean; error?: string | null }; isDark: boolean }) {
  const [showError, setShowError] = useState(false)
  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[18px]">🧩</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[13px] font-medium ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>{s.name}</span>
            {s.enabled ? (
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/30">
                Active
              </span>
            ) : (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isDark ? 'bg-zinc-700/50 text-zinc-400' : 'bg-zinc-100 text-zinc-500'}`}>
                Disabled
              </span>
            )}
          </div>
          {!s.error && !s.enabled && (
            <div className={`mt-0.5 text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Enable to load its commands and hooks.
            </div>
          )}
          {s.error && (
            <div className="mt-1">
              <button
                onClick={() => setShowError((v) => !v)}
                className="text-[11px] text-red-400 hover:text-red-300"
              >
                {showError ? 'Hide error' : 'Show error'}
              </button>
              {showError && (
                <div className={`mt-1 whitespace-pre-wrap rounded-md border p-2 font-mono text-[10px] ${
                  isDark ? 'border-red-500/20 bg-red-500/5 text-red-300' : 'border-red-200 bg-red-50 text-red-600'
                }`}>
                  {s.error}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => void usePluginStore.getState().toggle(s.name)}
          className={`relative shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
            s.enabled
              ? isDark
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : isDark
                ? 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
          }`}
        >
          {s.enabled ? 'Enabled' : 'Disabled'}
        </button>
        {s.enabled && (
          <button
            onClick={() => usePluginStore.getState().terminate(s.name)}
            title="Force stop plugin"
            aria-label={`Force stop ${s.name}`}
            className={`shrink-0 rounded px-1.5 py-1 text-[10px] transition-colors ${
              isDark ? 'text-zinc-500 hover:text-red-400' : 'text-zinc-400 hover:text-red-600'
            }`}
          >
            ■
          </button>
        )}
      </div>
    </div>
  )
}

export function PluginsView() {
  const isDark = useWorkspaceStore((s) => s.theme === 'dark')
  const statuses = usePluginStore((s) => s.statuses)
  const loading = usePluginStore((s) => s.loading)
  const hasWorkspace = useWorkspaceStore((s) => Boolean(s.workspace))

  useEffect(() => {
    void usePluginStore.getState().reload()
  }, [])

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
        <span className="text-[13px] font-medium">Plugins</span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          plain .js files in your vault's plugins/ folder
        </span>
        <div className="flex-1" />
        <button
          onClick={() => void usePluginStore.getState().reload()}
          disabled={loading || !hasWorkspace}
          className={btn}
        >
          {loading ? 'Loading…' : 'Reload plugins'}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {!hasWorkspace && (
          <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Open a workspace to manage its plugins.
          </p>
        )}
        {hasWorkspace && (
          <>
            <div className="space-y-2">
              {statuses.length === 0 && !loading && (
                <EmptyStatePanel icon="🧩" heading="No plugins found" description="Add a .js file to the plugins/ folder in your vault to extend Nexus with custom commands and hooks." />
              )}
              {statuses.map((s) => (
                <PluginCard key={s.name} s={s} isDark={isDark} />
              ))}
            </div>

            <div
              className={`rounded-lg border p-4 ${
                isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-white'
              }`}
            >
              <div className="mb-2 text-[12px] font-semibold">Plugin API</div>
              <ul className="space-y-1 text-[11px]">
                {API_DOCS.map((line) => (
                  <li
                    key={line}
                    className={`font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
