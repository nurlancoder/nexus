import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { linkingApi, type GraphNode } from '@/core/filesystem/api'
import { runLayout, clusterColor, type GraphNodePos } from '@/core/graph/layout'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'

interface GraphViewProps {
  focusPath?: string
}

export function GraphView({ focusPath }: GraphViewProps) {
  const { theme, workspace } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const isDark = theme === 'dark'

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [raw, setRaw] = useState<GraphNode[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [showIsolates, setShowIsolates] = useState(true)
  const [focus, setFocus] = useState<string | undefined>(focusPath)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [hover, setHover] = useState<string | null>(null)

  const panRef = useRef(pan)
  const zoomRef = useRef(zoom)
  const visibleRef = useRef<GraphNodePos[]>([])
  const isDarkRef = useRef(isDark)
  const hoverRef = useRef(hover)
  const focusRef = useRef(focus)

  useEffect(() => {
    panRef.current = pan
  }, [pan])
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])
  useEffect(() => {
    isDarkRef.current = isDark
  }, [isDark])
  useEffect(() => {
    hoverRef.current = hover
  }, [hover])
  useEffect(() => {
    focusRef.current = focus
  }, [focus])

  useEffect(() => {
    if (!workspace) return
    linkingApi
      .graph(workspace.path)
      .then((g) => {
        setRaw(g)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [workspace])

  const layout = useMemo(() => {
    if (raw.length === 0) return null
    return runLayout(raw, 1200, 800, 120)
  }, [raw])

  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const statsMemo = useMemo(
    () =>
      layout
        ? {
            nodes: layout.nodes.length,
            edges: layout.edges.length,
            clusters: layout.clusterCount,
          }
        : { nodes: 0, edges: 0, clusters: 0 },
    [layout],
  )

  const visible = useMemo(() => {
    if (!layout) return [] as GraphNodePos[]
    const q = query.trim().toLowerCase()
    let shown: GraphNodePos[] = layout.nodes
    if (q) {
      const matched = new Set(
        layout.nodes
          .filter((n) => n.node.title.toLowerCase().includes(q))
          .map((n) => n.node.path),
      )
      for (const n of layout.nodes) {
        for (const l of n.node.links) if (matched.has(l)) matched.add(n.node.path)
      }
      shown = layout.nodes.filter((n) => matched.has(n.node.path))
    }
    if (!showIsolates) {
      const connected = new Set<number>()
      for (const e of layout.edges) {
        connected.add(e.source)
        connected.add(e.target)
      }
      shown = shown.filter((_n, i) => connected.has(i) || q)
    }
    if (focus) {
      const all = new Set<string>([focus])
      for (const n of layout.nodes) {
        if (n.node.path === focus) for (const l of n.node.links) all.add(l)
        if (n.node.links.includes(focus)) all.add(n.node.path)
      }
      shown = layout.nodes.filter((n) => all.has(n.node.path))
    }
    return shown
  }, [layout, query, showIsolates, focus])

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const currentLayout = layoutRef.current
    if (!canvas || !currentLayout) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr
      canvas.height = h * dpr
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    ctx.save()
    ctx.translate(w / 2 + panRef.current.x, h / 2 + panRef.current.y)
    ctx.scale(zoomRef.current, zoomRef.current)

    const cx = currentLayout.nodes.reduce((s, n) => s + n.x, 0) / Math.max(1, currentLayout.nodes.length)
    const cy = currentLayout.nodes.reduce((s, n) => s + n.y, 0) / Math.max(1, currentLayout.nodes.length)

    const shownPaths = new Set(visibleRef.current.map((n) => n.node.path))
    const nodeIndex = new Map(currentLayout.nodes.map((n, i) => [n.node.path, i]))

    ctx.lineWidth = 1
    for (const e of currentLayout.edges) {
      const a = currentLayout.nodes[e.source]
      const b = currentLayout.nodes[e.target]
      if (!shownPaths.has(a.node.path) || !shownPaths.has(b.node.path)) continue
      ctx.strokeStyle = isDarkRef.current ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.3)'
      ctx.beginPath()
      ctx.moveTo(a.x - cx, a.y - cy)
      ctx.lineTo(b.x - cx, b.y - cy)
      ctx.stroke()
    }

    for (const n of visibleRef.current) {
      const i = nodeIndex.get(n.node.path)!
      const color = clusterColor(currentLayout.clusters.get(i) ?? 0, isDarkRef.current)
      const size = n.node.links.length === 0 && n.node.tags.length === 0 ? 4 : 7
      const isFocus = focusRef.current === n.node.path
      ctx.beginPath()
      ctx.arc(n.x - cx, n.y - cy, isFocus ? size + 3 : size, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = 0.9
      ctx.fill()
      ctx.globalAlpha = 1
      if (isFocus) {
        ctx.lineWidth = 2
        ctx.strokeStyle = isDarkRef.current ? '#facc15' : '#d97706'
        ctx.stroke()
      }
      if (hoverRef.current === n.node.path) {
        ctx.fillStyle = isDarkRef.current ? '#ffffff' : '#000000'
        ctx.font = '11px system-ui, sans-serif'
        ctx.textAlign = 'center'
        const label = n.node.title.length > 28 ? n.node.title.slice(0, 28) + '…' : n.node.title
        ctx.fillText(label, n.x - cx, n.y - cy - size - 6)
      }
    }
    ctx.restore()
  }, [])

  useEffect(() => {
    draw()
  }, [draw, visible, isDark, hover, pan, zoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let dragging = false
    let lastX = 0
    let lastY = 0

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const next = Math.min(3, Math.max(0.2, zoomRef.current * (e.deltaY < 0 ? 1.12 : 0.89)))
      setZoom(next)
    }

    const onMouseDown = (e: MouseEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
    }

    const onMouseMove = (e: MouseEvent) => {
      if (dragging) {
        setPan((p) => ({ x: p.x + (e.clientX - lastX), y: p.y + (e.clientY - lastY) }))
        lastX = e.clientX
        lastY = e.clientY
        return
      }
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const z = zoomRef.current
      const px = panRef.current
      const wx = (mx - rect.width / 2 - px.x) / z
      const wy = (my - rect.height / 2 - px.y) / z
      let found: string | null = null
      if (layout) {
        const cx = layout.nodes.reduce((s, n) => s + n.x, 0) / Math.max(1, layout.nodes.length)
        const cy = layout.nodes.reduce((s, n) => s + n.y, 0) / Math.max(1, layout.nodes.length)
        for (const n of visible) {
          const dx = n.x - cx - wx
          const dy = n.y - cy - wy
          if (dx * dx + dy * dy < 64) {
            found = n.node.path
            break
          }
        }
      }
      setHover(found)
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!dragging) return
      dragging = false
      if (Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY) < 4) {
        const rect = canvas.getBoundingClientRect()
        const z = zoomRef.current
        const px = panRef.current
        const wx = (e.clientX - rect.left - rect.width / 2 - px.x) / z
        const wy = (e.clientY - rect.top - rect.height / 2 - px.y) / z
        if (layout) {
          const cx = layout.nodes.reduce((s, n) => s + n.x, 0) / Math.max(1, layout.nodes.length)
          const cy = layout.nodes.reduce((s, n) => s + n.y, 0) / Math.max(1, layout.nodes.length)
          let hit: GraphNodePos | null = null
          for (const n of visible) {
            const dx = n.x - cx - wx
            const dy = n.y - cy - wy
            if (dx * dx + dy * dy < 64) {
              hit = n
              break
            }
          }
          if (hit) {
            setFocus(undefined)
            openNote(hit.node.path, hit.node.title)
          }
        }
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [layout, visible, openNote])

  const focusTitle = focus
    ? raw.find((n) => n.path === focus)?.title
    : undefined

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
        <span className="text-[13px] font-medium">Graph</span>
        <span
          className={`text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}
        >
          {statsMemo.nodes} nodes · {statsMemo.edges} edges · {statsMemo.clusters} clusters
        </span>
        <div className="flex-1" />
        {focusTitle && (
          <span
            className={`max-w-48 truncate rounded-full px-2 py-0.5 text-[11px] ${
              isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700'
            }`}
          >
            Focus: {focusTitle}
          </span>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title…"
          className={`w-40 rounded-md border px-2 py-1.5 text-[12px] outline-none ${
            isDark
              ? 'border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500'
              : 'border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400'
          }`}
        />
        <button onClick={() => setShowIsolates((v) => !v)} className={btn}>
          {showIsolates ? 'Hide isolates' : 'Show isolates'}
        </button>
        <button onClick={() => setFocus(undefined)} className={btn}>
          Clear focus
        </button>
        <button
          onClick={() => {
            setZoom(1)
            setPan({ x: 0, y: 0 })
          }}
          className={btn}
        >
          Reset
        </button>
      </div>
      <div ref={containerRef} className="relative min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-zinc-500">
            Building graph…
          </div>
        )}
        <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
      </div>
    </div>
  )
}