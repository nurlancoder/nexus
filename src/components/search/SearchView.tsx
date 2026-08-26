import { useEffect, useMemo, useRef, useState } from 'react'
import { searchApi, type SearchResult } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
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

const RECENT_KEY = 'nexus.recentSearches'
const MAX_RECENT = 10

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecent(query: string) {
  const list = loadRecent().filter((q) => q !== query)
  list.unshift(query)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)))
}

function Snippet({ snippet }: { snippet: string }) {
  const parts = snippet.split('\u0001')
  return (
    <span>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>
        return (
          <mark key={i} className="bg-yellow-200/60 font-semibold text-yellow-900">
            {part}
          </mark>
        )
      })}
    </span>
  )
}

export function SearchView() {
  const { theme, workspace, fileTree } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const isDark = theme === 'dark'

  const [query, setQuery] = useState('')
  const [folder, setFolder] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState('')
  const [recent, setRecent] = useState<string[]>(loadRecent())
  const [error, setError] = useState('')
  const timer = useRef<number | undefined>(undefined)

  const dirs = useMemo(() => collectDirs(fileTree), [fileTree])

  useEffect(() => {
    const q = query.trim()
    if (!workspace) return
    window.clearTimeout(timer.current)
    if (q.length < 2) return
    timer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchApi.query(workspace.path, q, 100)
        const filtered = folder
          ? res.filter((r) => r.path.replace(/\\/g, '/').includes(`/${folder}/`))
          : res
        setResults(filtered)
        setSearched(q)
        setError('')
      } catch (e) {
        setError(String(e))
        setResults([])
        setSearched(q)
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => window.clearTimeout(timer.current)
  }, [query, folder, workspace])

  const open = (r: SearchResult) => {
    if (query.trim()) saveRecent(query.trim())
    setRecent(loadRecent())
    openNote(r.path, r.title)
  }

  const inputCls = `w-full rounded-md border px-3 py-2 text-[14px] outline-none focus:ring-2 ${
    isDark
      ? 'border-zinc-700 bg-zinc-800 text-zinc-100 placeholder-zinc-500 focus:ring-blue-500/40'
      : 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:ring-blue-500/30'
  }`

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="p-4 pb-2">
        <div className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) open(results[0])
            }}
            placeholder="Search notes… (min 2 chars)"
            className={inputCls}
          />
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className={`shrink-0 rounded-md border px-2 py-2 text-[13px] outline-none ${
              isDark
                ? 'border-zinc-700 bg-zinc-800 text-zinc-200'
                : 'border-zinc-300 bg-white text-zinc-700'
            }`}
          >
            <option value="">All folders</option>
            {dirs.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {recent.length > 0 && !query && (
          <div className="mt-3">
            <p
              className={`mb-1 text-[10px] font-semibold uppercase tracking-widest ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              Recent searches
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {searching && (
          <p
            className={`text-[13px] ${
              isDark ? 'text-zinc-500' : 'text-zinc-400'
            }`}
          >
            Searching…
          </p>
        )}

        {!searching && searched === query.trim() && results.length === 0 && !error && (
          <p className="text-[13px] text-zinc-500">
            No results for “{query.trim()}”.
          </p>
        )}

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        {results.length > 0 && (
          <div className="space-y-1.5">
            {results.map((r) => (
              <button
                key={r.path}
                onClick={() => open(r)}
                className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  isDark
                    ? 'border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-[13px] font-medium ${
                      isDark ? 'text-zinc-100' : 'text-zinc-800'
                    }`}
                  >
                    {r.title}
                  </span>
                  <span
                    className={`truncate text-[11px] ${
                      isDark ? 'text-zinc-500' : 'text-zinc-400'
                    }`}
                  >
                    {r.path}
                  </span>
                </div>
                {r.snippet && (
                  <p
                    className={`mt-0.5 line-clamp-2 text-[12px] ${
                      isDark ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    <Snippet snippet={r.snippet} />
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}