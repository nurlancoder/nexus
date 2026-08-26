import { useEffect, useState } from 'react'
import { workspaceApi } from '@/core/filesystem/api'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { pickDirectory } from '@/lib/dialog'
import { isTauri } from '@/lib/tauriEnv'
import type { Workspace } from '@/types'

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
      <div className="text-center">
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
          className={`rounded-xl border p-5 ${
            isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
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
          className={`rounded-xl border p-5 ${
            isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
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
            className={`rounded-xl border p-5 ${
              isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'
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
      </div>

      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  )
}