import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { canvasApi } from '@/core/filesystem/api'
import {
  emptyCanvas,
  normalizeCanvas,
  pointInRect,
  uid,
  type CanvasData,
} from '@/core/canvas/types'
import { useWorkspaceStore } from '@/stores/workspaceStore'

const NODE_W = 180
const NODE_H = 70

interface CanvasViewProps {
  path: string
}

type Selection = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | { kind: 'group'; id: string } | null

export function CanvasView({ path }: CanvasViewProps) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'

  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<CanvasData>(emptyCanvas)
  const [loaded, setLoaded] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [shiftHeld, setShiftHeld] = useState(false)

  const viewport = data.viewport
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])
  const setViewport = useCallback(
    (vp: CanvasData['viewport']) => setData((d) => ({ ...d, viewport: vp })),
    [],
  )

  const dragRef = useRef<{
    mode: 'pan' | 'node' | 'group'
    id?: string
    startX: number
    startY: number
    origX: number
    origY: number
    moved: boolean
  } | null>(null)

  useEffect(() => {
    let alive = true
    canvasApi
      .load(path)
      .then((raw) => {
        if (!alive) return
        setData(normalizeCanvas(JSON.parse(raw)))
        setLoaded(true)
      })
      .catch(() => {
        if (!alive) return
        setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [path])

  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!loaded) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      canvasApi
        .save(path, JSON.stringify(data))
        .then(() => setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })))
        .catch(() => {})
    }, 500)
    return () => window.clearTimeout(saveTimer.current)
  }, [data, loaded, path])

  const mutate = useCallback((fn: (d: CanvasData) => CanvasData) => {
    setData((d) => fn(d))
  }, [])

  const worldFromClient = useCallback((cx: number, cy: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const localX = cx - rect.left
    const localY = cy - rect.top
    return {
      x: (localX - viewport.x) / viewport.zoom,
      y: (localY - viewport.y) / viewport.zoom,
    }
  }, [viewport])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const factor = e.deltaY < 0 ? 1.12 : 0.89
      const next = Math.min(2.5, Math.max(0.2, viewport.zoom * factor))
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const wx = (mx - viewport.x) / viewport.zoom
      const wy = (my - viewport.y) / viewport.zoom
      const x = mx - wx * next
      const y = my - wy * next
      setViewport({ x, y, zoom: next })
    },
    [viewport, setViewport],
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      const start = worldFromClient(e.clientX, e.clientY)
      dragRef.current = {
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origX: viewport.x,
        origY: viewport.y,
        moved: false,
      }
      if (selection) setSelection(null)
      void start
    },
    [worldFromClient, viewport, selection],
  )

  const startDrag = useCallback(
    (mode: 'node' | 'group', id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const start = worldFromClient(e.clientX, e.clientY)
      const target =
        mode === 'node' ? data.nodes.find((n) => n.id === id) : data.groups.find((g) => g.id === id)
      if (!target) return
      dragRef.current = {
        mode,
        id,
        startX: e.clientX,
        startY: e.clientY,
        origX: start.x - target.x,
        origY: start.y - target.y,
        moved: false,
      }
      setSelection(mode === 'node' ? { kind: 'node', id } : { kind: 'group', id })
      setEditingId(null)
    },
    [worldFromClient, data],
  )

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true) }
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

  const snapToGrid = useCallback((v: number, size = 20) => {
    return shiftHeld ? Math.round(v / size) * size : v
  }, [shiftHeld])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true

      if (drag.mode === 'pan') {
        setViewport({ ...viewport, x: drag.origX + dx, y: drag.origY + dy })
        return
      }

      const id = drag.id
      if (!id) return
      const start = worldFromClient(e.clientX, e.clientY)
      const nx = start.x - drag.origX
      const ny = start.y - drag.origY

      if (drag.mode === 'node') {
        setData((d) => ({
          ...d,
          nodes: d.nodes.map((n) =>
            n.id === id ? { ...n, x: snapToGrid(nx), y: snapToGrid(ny) } : n,
          ),
        }))
      } else {
        setData((d) => {
          const group = d.groups.find((g) => g.id === id)
          if (!group) return d
          const dxm = nx - group.x
          const dym = ny - group.y
          return {
            ...d,
            groups: d.groups.map((g) =>
              g.id === id ? { ...g, x: snapToGrid(nx), y: snapToGrid(ny) } : g,
            ),
            nodes: d.nodes.map((n) =>
              n.groupId === id ? { ...n, x: n.x + dxm, y: n.y + dym } : n,
            ),
          }
        })
      }
    }

    const onUp = () => {
      const drag = dragRef.current
      if (drag && drag.mode === 'node' && drag.id) {
        const n = dataRef.current.nodes.find((x) => x.id === drag.id)
        if (n) {
          const cx = n.x + n.w / 2
          const cy = n.y + n.h / 2
          const group = dataRef.current.groups.find(
            (g) => pointInRect(cx, cy, g.x, g.y, g.w, g.h),
          )
          setData((d) => ({
            ...d,
            nodes: d.nodes.map((x) =>
              x.id === drag.id ? { ...x, groupId: group?.id } : x,
            ),
          }))
        }
      }
      dragRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [viewport, setViewport, setData, worldFromClient, snapToGrid])

  const addNode = useCallback(
    (wx?: number, wy?: number) => {
      const pos = { x: wx ?? 40, y: wy ?? 40 }
      const id = uid('node')
      mutate((d) => ({
        ...d,
        nodes: [...d.nodes, { id, x: pos.x, y: pos.y, w: NODE_W, h: NODE_H, text: 'Double-click to edit' }],
      }))
      setSelection({ kind: 'node', id })
      setEditingId(id)
      setDraft('')
    },
    [mutate],
  )

  const addGroup = useCallback(() => {
    const id = uid('group')
    mutate((d) => ({
      ...d,
      groups: [
        ...d.groups,
        { id, x: 40, y: 40, w: 320, h: 200, label: 'Group' },
      ],
    }))
    setSelection({ kind: 'group', id })
  }, [mutate])

  const onNodeClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (connectMode) {
        if (!connectFrom) {
          setConnectFrom(id)
          return
        }
        if (connectFrom === id) {
          setConnectFrom(null)
          return
        }
        const exists = data.edges.some(
          (ed) =>
            (ed.from === connectFrom && ed.to === id) ||
            (ed.from === id && ed.to === connectFrom),
        )
        if (!exists) {
          mutate((d) => ({
            ...d,
            edges: [...d.edges, { id: uid('edge'), from: connectFrom, to: id }],
          }))
        }
        setConnectFrom(null)
        return
      }
      setSelection({ kind: 'node', id })
    },
    [connectMode, connectFrom, data.edges, mutate],
  )

  const onEdgeClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setSelection({ kind: 'edge', id })
    },
    [],
  )

  const deleteSelected = useCallback(() => {
    if (!selection) return
    if (selection.kind === 'node') {
      const id = selection.id
      mutate((d) => ({
        ...d,
        nodes: d.nodes.filter((n) => n.id !== id),
        edges: d.edges.filter((ed) => ed.from !== id && ed.to !== id),
      }))
    } else if (selection.kind === 'edge') {
      mutate((d) => ({ ...d, edges: d.edges.filter((ed) => ed.id !== selection.id) }))
    } else if (selection.kind === 'group') {
      const id = selection.id
      mutate((d) => ({
        ...d,
        groups: d.groups.filter((g) => g.id !== id),
        nodes: d.nodes.map((n) => (n.groupId === id ? { ...n, groupId: undefined } : n)),
      }))
    }
    setSelection(null)
  }, [selection, mutate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteSelected()
      }
      if (e.key === 'Escape') {
        setSelection(null)
        setConnectMode(false)
        setConnectFrom(null)
        setEditingId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    mutate((d) => ({
      ...d,
      nodes: d.nodes.map((n) =>
        n.id === editingId ? { ...n, text: draft.trim() || 'Empty' } : n,
      ),
    }))
    setEditingId(null)
  }, [editingId, draft, mutate])

  const nodesById = useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n])),
    [data.nodes],
  )

  const renderEdges = () => {
    const lines: React.ReactNode[] = []
    const markerId = 'arrowhead'
    lines.push(
      <defs key="defs">
        <marker id={markerId} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill={isDark ? '#64748b' : '#a1a1aa'} />
        </marker>
      </defs>,
    )
    for (const edge of data.edges) {
      const a = nodesById.get(edge.from)
      const b = nodesById.get(edge.to)
      if (!a || !b) continue
      const x1 = a.x + a.w / 2
      const y1 = a.y + a.h / 2
      const x2 = b.x + b.w / 2
      const y2 = b.y + b.h / 2
      const selected = selection?.kind === 'edge' && selection.id === edge.id
      const midX = (x1 + x2) / 2
      const midY = (y1 + y2) / 2
      const angle = Math.atan2(y2 - y1, x2 - x1)
      const arrowX = x2 - Math.cos(angle) * 8
      const arrowY = y2 - Math.sin(angle) * 8
      lines.push(
        <g key={edge.id} onClick={(e) => onEdgeClick(edge.id, e)}>
          <line
            x1={x1}
            y1={y1}
            x2={arrowX}
            y2={arrowY}
            stroke={selected ? '#f59e0b' : isDark ? '#64748b' : '#a1a1aa'}
            strokeWidth={selected ? 2.5 : 2}
            markerEnd={`url(#${markerId})`}
          />
          <circle cx={midX} cy={midY} r={6} fill="transparent" />
        </g>,
      )
    }
    return lines
  }

  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`

  const btnActive = `rounded-md px-2.5 py-1.5 text-[12px] ${
    isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
  }`

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-zinc-500">
        Loading canvas…
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-11 shrink-0 items-center gap-1.5 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Canvas</span>
        <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {data.nodes.length} nodes · {data.edges.length} edges · {data.groups.length} groups
        </span>
        {savedAt && (
          <span className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Saved {savedAt}
          </span>
        )}
        <div className="flex-1" />
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
            isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-600'
          }`}
        >
          {Math.round(viewport.zoom * 100)}%
        </span>
        <div className={`mx-1 h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
        <button onClick={() => addNode()} className={btn} aria-label="Add node">
          Add node
        </button>
        <button onClick={() => addGroup()} className={btn} aria-label="Add group">
          Add group
        </button>
        <div className={`mx-1 h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
        <button
          onClick={() => {
            setConnectMode((c) => !c)
            setConnectFrom(null)
          }}
          className={connectMode ? btnActive : btn}
          aria-label="Connect nodes"
        >
          {connectMode
            ? connectFrom
              ? 'Connect: pick target'
              : 'Connect: pick source'
            : 'Connect'}
        </button>
        <button
          onClick={deleteSelected}
          disabled={!selection}
          className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Delete selected"
        >
          Delete
        </button>
        <div className={`mx-1 h-4 w-px ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
        <button
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
          className={btn}
          aria-label="Reset view"
        >
          Reset
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onDoubleClick={(e) => {
          const p = worldFromClient(e.clientX, e.clientY)
          addNode(p.x, p.y)
        }}
      >
        {data.nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] text-zinc-400 pointer-events-none select-none">
            <svg className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Double-click to add a node</span>
          </div>
        )}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          }}
        >
          <svg className="absolute overflow-visible" width="1" height="1">
            {renderEdges()}
          </svg>

          {data.groups.map((g) => {
            const selected = selection?.kind === 'group' && selection.id === g.id
            return (
              <div
                key={g.id}
                onMouseDown={(e) => startDrag('group', g.id, e)}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelection({ kind: 'group', id: g.id })
                }}
                className={`absolute rounded-lg border-2 ${
                  selected
                    ? isDark
                      ? 'border-amber-400/80 bg-gradient-to-br from-amber-400/10 to-amber-400/5'
                      : 'border-amber-500/80 bg-gradient-to-br from-amber-100/40 to-amber-100/20'
                    : isDark
                      ? 'border-zinc-600/60 bg-gradient-to-br from-zinc-800/15 to-zinc-800/5'
                      : 'border-zinc-300 bg-gradient-to-br from-zinc-100/40 to-zinc-100/10'
                }`}
                style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
              >
                <div
                  className={`px-2 py-0.5 text-[11px] font-semibold ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  {g.label}
                </div>
              </div>
            )
          })}

          {data.nodes.map((n) => {
            const selected = selection?.kind === 'node' && selection.id === n.id
            const inGroup = data.groups.some((g) => g.id === n.groupId)
            const isConnectSource = connectMode && connectFrom === n.id
            return (
              <div
                key={n.id}
                onMouseDown={(e) => startDrag('node', n.id, e)}
                onClick={(e) => onNodeClick(n.id, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  setEditingId(n.id)
                  setDraft(n.text)
                }}
                className={`absolute flex items-center justify-center rounded-md border px-3 py-2 text-center text-[12px] shadow-sm transition-shadow ${
                  isConnectSource
                    ? 'animate-pulse border-blue-400 shadow-md shadow-blue-400/20'
                    : ''
                } ${
                  !isConnectSource && selected
                    ? isDark
                      ? 'border-amber-400 shadow-md shadow-amber-400/10 bg-zinc-800'
                      : 'border-amber-500 shadow-md shadow-amber-500/10 bg-white'
                    : !isConnectSource && inGroup
                      ? isDark
                        ? 'border-zinc-600 shadow-sm bg-zinc-800/80'
                        : 'border-zinc-300 shadow-sm bg-zinc-50'
                      : !isConnectSource
                        ? isDark
                          ? 'border-zinc-700 shadow-sm bg-zinc-800'
                          : 'border-zinc-200 shadow-sm bg-white'
                        : ''
                }`}
                style={{ left: n.x, top: n.y, width: n.w, height: n.h }}
              >
                {editingId === n.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full bg-transparent text-center text-[12px] outline-none ${
                      isDark ? 'text-zinc-100' : 'text-zinc-800'
                    }`}
                  />
                ) : (
                  <span className={`${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>
                    {n.text}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}