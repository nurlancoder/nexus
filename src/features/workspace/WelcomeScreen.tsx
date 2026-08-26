import { useEffect, useState } from 'react'
import { workspaceApi } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { pickDirectory } from '@/lib/dialog'
import { isTauri } from '@/lib/tauriEnv'
import type { Workspace } from '@/types'

const RECENT_STORAGE_KEY = 'nexus.recentPaths'
const MAX_BROWSER_RECENT = 5

function loadBrowserRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveBrowserRecent(paths: string[]) {
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(paths))
}

function addBrowserRecent(path: string) {
  const list = loadBrowserRecent().filter((p) => p !== path)
  list.unshift(path)
  saveBrowserRecent(list.slice(0, MAX_BROWSER_RECENT))
}

function folderName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

export function WelcomeScreen() {
  const theme = useWorkspaceStore((s) => s.theme)
  const recent = useWorkspaceStore((s) => s.recentWorkspaces)
  const workspaceLoading = useWorkspaceStore((s) => s.workspaceLoading)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const isDark = theme === 'dark'

  useEffect(() => {
    workspaceApi
      .recent()
      .then((list) => useWorkspaceStore.getState().setRecentWorkspaces(list))
      .catch(() => {})
  }, [])

  const openWorkspace = async (path: string) => {
    setError('')
    useWorkspaceStore.getState().setWorkspaceLoading(true)
    try {
      const ws = await workspaceApi.open(path)
      const tree = await workspaceApi.tree(path)
      useWorkspaceStore.getState().activateWorkspace(ws, tree)
      useWorkspaceStore.getState().setWorkspaceLoading(false)
      if (!isTauri()) addBrowserRecent(path)
    } catch (e) {
      setError(String(e))
      useWorkspaceStore.getState().setWorkspaceLoading(false)
    }
  }

  const createWorkspace = async () => {
    if (!name.trim()) {
      setError('Enter a workspace name')
      return
    }
    const parent = await pickDirectory('Choose where to create the workspace')
    if (!parent) return
    setError('')
    useWorkspaceStore.getState().setWorkspaceLoading(true)
    try {
      const ws = await workspaceApi.create(name.trim(), parent)
      const tree = await workspaceApi.tree(ws.path)
      useWorkspaceStore.getState().activateWorkspace(ws, tree)
      useWorkspaceStore.getState().setWorkspaceLoading(false)
    } catch (e) {
      setError(String(e))
      useWorkspaceStore.getState().setWorkspaceLoading(false)
    }
  }

  const pickOpen = async () => {
    const path = await pickDirectory('Choose a workspace folder')
    if (!path) return
    await openWorkspace(path)
  }

  const btn = `rounded-md px-4 py-2 text-[13px] font-medium transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
  }`

  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-10 px-6 ${
        isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
      }`}
    >
      <div className="nexus-scale-in text-center">
        <h1 className="text-3xl font-bold tracking-wide">NEXUS</h1>
        <p className={`mt-2 text-[13px] ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
          Local-first knowledge workspace
        </p>
      </div>

      <div
        className={`grid w-full max-w-3xl gap-4 sm:grid-cols-3 ${
          !isTauri() ? 'sm:grid-cols-2' : ''
        }`}
      >
        <div
          className={`rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${
            isDark
              ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
              : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-zinc-200/50'
          }`}
        >
          <h2 className="mb-1 text-sm font-semibold">Create workspace</h2>
          <p className={`mb-3 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            New vault with inbox, notes, projects and templates folders
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workspace name"
            className={`mb-2 w-full rounded-md border px-3 py-2 text-[13px] outline-none ${
              isDark
                ? 'border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500'
                : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
            }`}
          />
          <button
            onClick={createWorkspace}
            disabled={workspaceLoading}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-[13px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Create
          </button>
        </div>

        <div
          className={`rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${
            isDark
              ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
              : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-zinc-200/50'
          }`}
        >
          <h2 className="mb-1 text-sm font-semibold">Open workspace</h2>
          <p className={`mb-3 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Open an existing folder as a workspace
          </p>
          <button
            onClick={pickOpen}
            disabled={workspaceLoading}
            className={`${btn} w-full disabled:opacity-50`}
          >
            Open folder…
          </button>
        </div>

        {isTauri() && (
          <div
            className={`rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${
              isDark
                ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-zinc-200/50'
            }`}
          >
            <h2 className="mb-1 text-sm font-semibold">Recent</h2>
            <p className={`mb-3 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              Previously opened workspaces
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {recent.length === 0 && (
                <p className={`text-[12px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  None yet
                </p>
              )}
              {recent.map((ws: Workspace) => (
                <button
                  key={ws.path}
                  onClick={() => openWorkspace(ws.path)}
                  disabled={workspaceLoading}
                  className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  {ws.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isTauri() && (
          <BrowserRecent
            onOpen={openWorkspace}
            isDark={isDark}
            disabled={workspaceLoading}
          />
        )}
      </div>

      {error && (
        <div
          className={`w-full max-w-3xl rounded-lg border px-4 py-3 text-[12px] ${
            isDark
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : 'border-red-300 bg-red-50 text-red-600'
          }`}
        >
          {error}
        </div>
      )}

      <div
        className={`flex items-center gap-4 text-[11px] ${
          isDark ? 'text-zinc-600' : 'text-zinc-400'
        }`}
      >
        <span>⌘K to open commands</span>
        <span>·</span>
        <span>⌘N to create a note</span>
        <span>·</span>
        <span>v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}</span>
      </div>
    </div>
  )
}

function BrowserRecent({
  onOpen,
  isDark,
  disabled,
}: {
  onOpen: (path: string) => void
  isDark: boolean
  disabled: boolean
}) {
  const [paths] = useState<string[]>(() => loadBrowserRecent())

  if (paths.length === 0) return null

  return (
    <div
      className={`rounded-xl border p-5 transition-all hover:scale-[1.02] hover:shadow-lg ${
        isDark
          ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          : 'border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-zinc-200/50'
      }`}
    >
      <h2 className="mb-1 text-sm font-semibold">Recent</h2>
      <p className={`mb-3 text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Recently opened paths
      </p>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {paths.map((p) => (
          <button
            key={p}
            onClick={() => onOpen(p)}
            disabled={disabled}
            className="block w-full truncate rounded-md px-2 py-1.5 text-left text-[12px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {folderName(p)}
          </button>
        ))}
      </div>
    </div>
  )
}