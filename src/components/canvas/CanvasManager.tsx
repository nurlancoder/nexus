import { useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { canvasApi } from '@/core/filesystem/api'
import { refreshTree } from '@/features/notes/actions'
import { joinPath } from '@/lib/paths'
import type { FileNode } from '@/types'

const CANVAS_RE = /\.canvas$/i

function collectCanvases(nodes: FileNode[]): { path: string; name: string }[] {
  const out: { path: string; name: string }[] = []
  for (const n of nodes) {
    if (n.isDir) out.push(...collectCanvases(n.children))
    else if (CANVAS_RE.test(n.name))
      out.push({ path: n.path, name: n.name.replace(CANVAS_RE, '') })
  }
  return out
}

export function CanvasManager() {
  const { theme, workspace, fileTree } = useWorkspaceStore()
  const openCanvas = useTabStore((s) => s.openCanvas)
  const isDark = theme === 'dark'
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const canvases = useMemo(() => collectCanvases(fileTree), [fileTree])

  const create = async () => {
    if (!workspace || creating) return
    const name = window.prompt('Canvas name:', 'Untitled')
    if (name === null) return
    setCreating(true)
    setError('')
    try {
      const canvasesDir = await joinPath(workspace.path, '08-Canvas')
      const path = await canvasApi.create(canvasesDir, name)
      await refreshTree()
      openCanvas(path, name || 'Untitled')
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  const btn = `rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
  }`

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">Canvases</h2>
        <button onClick={() => void create()} disabled={creating} className={btn}>
          {creating ? 'Creating…' : 'New canvas'}
        </button>
      </div>

      {error && <p className="mb-3 text-[12px] text-red-500">{error}</p>}

      {canvases.length === 0 ? (
        <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          No canvases yet. Create one to start an infinite workspace.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {canvases.map((c) => (
            <button
              key={c.path}
              onClick={() => openCanvas(c.path, c.name)}
              className={`group flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                isDark
                  ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'
              }`}
            >
              <span className="text-3xl opacity-60">◇</span>
              <span
                className={`text-[13px] font-medium ${
                  isDark ? 'text-zinc-200' : 'text-zinc-700'
                }`}
              >
                {c.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}