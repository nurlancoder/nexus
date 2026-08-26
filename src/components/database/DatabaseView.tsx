import { useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import {
  defaultDatabaseDefinition,
  useDatabaseStore,
} from '@/stores/databaseStore'
import {
  databaseApi,
  type DatabaseDefinition,
  type DatabaseRow,
} from '@/core/filesystem/api'
import {
  matchesFilter,
  sortRows,
  discoverColumns,
  visibleColumns,
} from '@/core/database/model'
import type { FileNode } from '@/types'

function collectDirs(nodes: FileNode[], base = ''): string[] {
  const dirs: string[] = []
  for (const n of nodes) {
    if (n.isDir) {
      const name = base ? `${base}/${n.name}` : n.name
      dirs.push(name)
      dirs.push(...collectDirs(n.children, name))
    }
  }
  return dirs
}

export function DatabaseView() {
  const { theme, workspace, fileTree } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const metas = useDatabaseStore((s) => s.metas)
  const activeName = useDatabaseStore((s) => s.activeName)
  const setActive = useDatabaseStore((s) => s.setActive)
  const isDark = theme === 'dark'

  const [def, setDef] = useState<DatabaseDefinition>(defaultDatabaseDefinition())
  const [data, setData] = useState<DatabaseRow[] | null>(null)
  const [error, setError] = useState('')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [newName, setNewName] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const active = metas.find((m) => m.name === activeName)
  const dirs = useMemo(() => collectDirs(fileTree), [fileTree])

  const persistTimer = useRef<number | undefined>(undefined)

  const [prevActiveName, setPrevActiveName] = useState<string | null>(activeName)
  if (prevActiveName !== activeName) {
    setPrevActiveName(activeName)
    setDef(active ? { ...active.definition } : defaultDatabaseDefinition())
    setData(null)
  }

  useEffect(() => {
    void useDatabaseStore.getState().load()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrolled(el.scrollTop > 2)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!workspace || !activeName) return
    let alive = true
    databaseApi
      .rows(workspace.path, def.sourceFolders)
      .then((r) => {
        if (!alive) return
        setData(r)
        setError('')
      })
      .catch((e) => {
        if (!alive) return
        setData(null)
        setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [workspace, workspace?.path, activeName, def.sourceFolders, refreshNonce])

  const updateDef = (patch: Partial<DatabaseDefinition>) => {
    if (!activeName) return
    const name = activeName
    setDef((d) => {
      const next = { ...d, ...patch }
      window.clearTimeout(persistTimer.current)
      persistTimer.current = window.setTimeout(() => {
        if (useDatabaseStore.getState().activeName !== name) return
        void useDatabaseStore.getState().persistDefinition(name, next)
      }, 500)
      return next
    })
  }

  const rows = useMemo(() => data ?? [], [data])
  const loading = activeName != null && data === null && !error

  const filtered = useMemo(
    () => rows.filter((r) => matchesFilter(r, def.filterKey, def.filterValue)),
    [rows, def.filterKey, def.filterValue],
  )
  const sorted = useMemo(
    () =>
      sortRows(filtered, def.sortKey, def.sortDir === 'desc' ? 'desc' : 'asc'),
    [filtered, def.sortKey, def.sortDir],
  )
  const columns = useMemo(
    () => visibleColumns(rows, def.columns),
    [rows, def.columns],
  )
  const chipKeys = useMemo(() => {
    const s = new Set<string>([...discoverColumns(rows), ...(def.columns ?? [])])
    s.delete('')
    return [...s]
  }, [rows, def.columns])

  const toggleColumn = (key: string) => {
    const base = (def.columns ?? []).length > 0 ? [...def.columns] : discoverColumns(rows)
    const next = base.includes(key)
      ? base.filter((k) => k !== key)
      : [...base, key]
    updateDef({ columns: next })
  }

  const create = () => {
    if (!newName.trim()) return
    void useDatabaseStore.getState().create(newName.trim())
    setNewName('')
  }

  const removeActive = () => {
    if (!activeName) return
    void useDatabaseStore.getState().remove(activeName)
  }

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
        <span className="text-[13px] font-medium">Databases</span>
        <select
          value={activeName ?? ''}
          onChange={(e) => setActive(e.target.value || null)}
          className={`max-w-40 rounded-md border px-2 py-1 text-[12px] outline-none ${
            isDark
              ? 'border-zinc-700 bg-zinc-800 text-zinc-200'
              : 'border-zinc-300 bg-white text-zinc-800'
          }`}
        >
          <option value="">No database</option>
          {metas.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') create()
          }}
          placeholder="New database…"
          className={`w-32 rounded-md border px-2 py-1 text-[12px] outline-none ${
            isDark
              ? 'border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-500'
              : 'border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400'
          }`}
        />
        <button onClick={create} disabled={!newName.trim()} className={`${btn} disabled:opacity-40`}>
          Create
        </button>
        <div className="flex-1" />
        {activeName && (
          <>
            <button onClick={() => setRefreshNonce((n) => n + 1)} className={btn}>
              Refresh
            </button>
            <button
              onClick={removeActive}
              className={`rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                isDark
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              Delete
            </button>
          </>
        )}
      </div>

      {!activeName ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="text-5xl opacity-40">▦</div>
          <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            No databases yet. Create one to build a table view over your note
            properties.
          </p>
        </div>
      ) : (
        <>
          <div
            className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 ${
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            }`}
          >
            <select
              value={def.sourceFolders[0] ?? ''}
              onChange={(e) =>
                updateDef({ sourceFolders: e.target.value ? [e.target.value] : [] })
              }
              className={inputCls}
            >
              <option value="">All folders</option>
              {dirs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="relative">
              <input
                value={def.filterKey ?? ''}
                onChange={(e) => updateDef({ filterKey: e.target.value || null })}
                placeholder="Property"
                className={`${inputCls} w-28 pr-5`}
              />
              {def.filterKey && (
                <button
                  onClick={() => updateDef({ filterKey: null })}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 text-[10px] ${
                    isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="relative">
              <input
                value={def.filterValue ?? ''}
                onChange={(e) => updateDef({ filterValue: e.target.value || null })}
                placeholder="Equals… (a, b = or)"
                className={`${inputCls} w-36 pr-5`}
              />
              {def.filterValue && (
                <button
                  onClick={() => updateDef({ filterValue: null })}
                  className={`absolute right-1 top-1/2 -translate-y-1/2 text-[10px] ${
                    isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  ✕
                </button>
              )}
            </div>
            <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Sort by
            </span>
            <select
              value={def.sortKey ?? ''}
              onChange={(e) => updateDef({ sortKey: e.target.value || null })}
              className={inputCls}
            >
              <option value="">Title</option>
              {chipKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                updateDef({ sortDir: def.sortDir === 'desc' ? 'asc' : 'desc' })
              }
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                def.sortKey
                  ? isDark
                    ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
              }`}
              title="Toggle sort direction"
            >
              {def.sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>

          {(chipKeys.length > 0 || (def.columns ?? []).length > 0) && (
            <div
              className={`flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2 ${
                isDark ? 'border-zinc-800' : 'border-zinc-200'
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest ${
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                Columns
              </span>
              {chipKeys.map((k) => {
                const on = columns.includes(k)
                const chipColors: Record<string, string> = {
                  status: on ? (isDark ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200') : '',
                  tags: on ? (isDark ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200') : '',
                  priority: on ? (isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200') : '',
                }
                const colorClass = chipColors[k] || (on
                  ? isDark
                    ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : isDark
                    ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200')
                return (
                  <button
                    key={k}
                    onClick={() => toggleColumn(k)}
                    className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${colorClass}`}
                  >
                    {on ? '✓ ' : ''}
                    {k}
                  </button>
                )
              })}
            </div>
          )}

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            {loading && (
              <p
                className={`p-4 text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
              >
                Loading notes…
              </p>
            )}
            {error && <p className="p-4 text-[13px] text-red-500">{error}</p>}
            {!loading && !error && sorted.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <div className="text-4xl opacity-40">▦</div>
                <p className={`text-[13px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  No matching notes
                </p>
                <p className={`text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {def.filterKey || def.filterValue ? 'Try adjusting your filters.' : 'No notes found in the selected source folders.'}
                </p>
              </div>
            )}
            {!loading && !error && sorted.length > 0 && (
              <table className="w-full border-collapse text-left text-[12px]">
                <thead>
                  <tr
                    className={`sticky top-0 z-10 transition-shadow ${
                      isDark ? 'bg-zinc-900' : 'bg-white'
                    } ${scrolled ? 'shadow-sm' : ''}`}
                  >
                    <th
                      className={`border-b px-3 py-2 font-semibold ${
                        isDark
                          ? 'border-zinc-800 text-zinc-400'
                          : 'border-zinc-200 text-zinc-500'
                      }`}
                    >
                      Title
                    </th>
                    {columns.map((c) => (
                      <th
                        key={c}
                        className={`border-b px-3 py-2 font-semibold capitalize ${
                          isDark
                            ? 'border-zinc-800 text-zinc-400'
                            : 'border-zinc-200 text-zinc-500'
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr
                      key={r.path}
                      onClick={() => openNote(r.path, r.title)}
                      title={r.path}
                      className={`cursor-pointer transition-colors ${
                        isDark ? 'hover:bg-zinc-800/60' : 'hover:bg-zinc-100'
                      }`}
                    >
                      <td
                        className={`border-b px-3 py-1.5 font-medium ${
                          isDark
                            ? 'border-zinc-800/60 text-zinc-200'
                            : 'border-zinc-100 text-zinc-800'
                        }`}
                      >
                        {r.title}
                      </td>
                      {columns.map((c) => (
                        <td
                          key={c}
                          className={`border-b px-3 py-1.5 ${
                            isDark
                              ? 'border-zinc-800/60 text-zinc-400'
                              : 'border-zinc-100 text-zinc-600'
                          }`}
                        >
                          {r.properties[c] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            className={`flex h-6 shrink-0 items-center gap-3 border-t px-3 text-[11px] ${
              isDark
                ? 'border-zinc-800 text-zinc-500'
                : 'border-zinc-200 text-zinc-400'
            }`}
          >
            <span>
              {sorted.length} of {rows.length} notes · {columns.length} columns
            </span>
            <span className="ml-auto">Click a row to open the note</span>
          </div>
        </>
      )}
    </div>
  )
}
