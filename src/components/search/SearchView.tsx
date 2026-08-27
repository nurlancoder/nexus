import { useEffect, useMemo, useRef, useState } from 'react'
import { searchApi, type SearchResult } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { collectDirs } from '@/lib/tree'
import {
  loadSavedSearches,
  saveSearch,
  renameSavedSearch,
  deleteSavedSearch,
} from '@/lib/savedSearches'
import { EmptyStatePanel } from '@/components/ui/EmptyStatePanel'

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

function HighlightedText({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <span>{text}</span>
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200/60 font-semibold text-yellow-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
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
  const [saved, setSaved] = useState(loadSavedSearches())
  const [savedOpen, setSavedOpen] = useState(false)
  const [renameIndex, setRenameIndex] = useState<number | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const timer = useRef<number | undefined>(undefined)

  const dirs = useMemo(() => collectDirs(fileTree), [fileTree])

  useEffect(() => {
    const q = query.trim()
    if (!workspace) return
    window.clearTimeout(timer.current)
    if (q.length < 2) {
      // oxlint-disable-next-line set-state-in-effect — clear stale results when query short
      setResults([])
      setSelectedIndex(0)
      setSearching(false)
      return
    }
    timer.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const res = await searchApi.query(workspace.path, q, 100)
        const filtered = folder
          ? res.filter((r) => r.path.replace(/\\/g, '/').includes(`/${folder}/`))
          : res
        setResults(filtered)
        setSelectedIndex(0)
        setSearched(q)
        setError('')
      } catch (e) {
        setError(String(e))
        setResults([])
        setSelectedIndex(0)
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
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && results[selectedIndex]) {
                open(results[selectedIndex])
              }
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
          {query.trim().length >= 2 && (
            <button
              onClick={() => {
                saveSearch(query.trim(), query.trim())
                setSaved(loadSavedSearches())
                setSavedOpen(true)
              }}
              title="Save this search"
              className={`shrink-0 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${
                isDark
                  ? 'border-zinc-600 bg-zinc-700 text-zinc-100 hover:bg-zinc-600'
                  : 'border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              Save
            </button>
          )}
        </div>

        {saved.length > 0 && !query && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <button
                onClick={() => setSavedOpen((o) => !o)}
                aria-expanded={savedOpen}
                className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <span
                  className={`inline-block transition-transform ${savedOpen ? 'rotate-90' : ''}`}
                >
                  ▶
                </span>
                Saved searches
              </button>
            </div>
            {savedOpen && (
              <ul className="space-y-1">
                {saved.map((s, i) => (
                  <li
                    key={`${s.query}-${i}`}
                    className={`group flex items-center justify-between rounded-md px-2 py-1 ${
                      isDark ? 'bg-zinc-800' : 'bg-zinc-100'
                    }`}
                  >
                    {renameIndex === i ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameSavedSearch(i, renameDraft)
                            setSaved(loadSavedSearches())
                            setRenameIndex(null)
                          } else if (e.key === 'Escape') {
                            setRenameIndex(null)
                          }
                        }}
                        onBlur={() => {
                          renameSavedSearch(i, renameDraft)
                          setSaved(loadSavedSearches())
                          setRenameIndex(null)
                        }}
                        className={`w-full rounded border px-1.5 py-0.5 text-[12px] outline-none ${
                          isDark
                            ? 'border-zinc-600 bg-zinc-900 text-zinc-100'
                            : 'border-zinc-300 bg-white text-zinc-900'
                        }`}
                      />
                    ) : (
                      <button
                        onClick={() => setQuery(s.query)}
                        className="min-w-0 flex-1 text-left leading-tight"
                      >
                        <span className="block truncate text-[12.5px] font-medium">
                          {s.name}
                        </span>
                        <span
                          className={`block max-w-full truncate text-[11px] ${
                            isDark ? 'text-zinc-500' : 'text-zinc-400'
                          }`}
                        >
                          {s.query}
                        </span>
                      </button>
                    )}
                    {renameIndex !== i && (
                      <span className="ml-2 flex shrink-0 items-center gap-1">
                        <button
                          aria-label={`Rename saved search ${s.name}`}
                          title="Rename"
                          onClick={() => {
                            setRenameIndex(i)
                            setRenameDraft(s.name)
                          }}
                          className={`rounded px-1 text-[11px] transition-colors ${
                            isDark
                              ? 'text-zinc-500 hover:text-zinc-200'
                              : 'text-zinc-400 hover:text-zinc-700'
                          }`}
                        >
                          ✎
                        </button>
                        <button
                          aria-label={`Delete saved search ${s.name}`}
                          title="Delete"
                          onClick={() => {
                            deleteSavedSearch(i)
                            setSaved(loadSavedSearches())
                          }}
                          className={`rounded px-1 text-[11px] transition-colors ${
                            isDark
                              ? 'text-zinc-500 hover:text-red-400'
                              : 'text-zinc-400 hover:text-red-500'
                          }`}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {recent.length > 0 && !query && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <p
                className={`text-[10px] font-semibold uppercase tracking-widest ${
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                Recent searches
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem(RECENT_KEY)
                  setRecent([])
                }}
                className={`text-[10px] transition-colors ${
                  isDark
                    ? 'text-zinc-600 hover:text-zinc-400'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                Clear history
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuery(q)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    isDark
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
                      : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-800'
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
          <div className="flex items-center gap-2 py-2">
            <span className="nexus-spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
            <span
              className={`text-[13px] ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              Searching…
            </span>
          </div>
        )}

        {!searching && searched === query.trim() && results.length === 0 && !error && (
          <EmptyStatePanel icon="🔍" heading={`No results for "${query.trim()}"`} description="Try different keywords or check your folder filter." />
        )}

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        {results.length > 0 && (
          <>
            <p
              className={`mb-2 text-[11px] ${
                isDark ? 'text-zinc-500' : 'text-zinc-400'
              }`}
            >
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </p>
            <div className="space-y-1.5">
              {results.map((r, i) => (
                <button
                  key={r.path}
                  onClick={() => open(r)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
                    i === selectedIndex
                      ? isDark
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : 'border-blue-400 bg-blue-50'
                      : isDark
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
                      <HighlightedText text={r.title} term={query.trim()} />
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
          </>
        )}
      </div>
    </div>
  )
}