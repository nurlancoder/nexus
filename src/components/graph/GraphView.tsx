import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { linkingApi, type GraphNode } from '@/core/filesystem/api'
import { runLayout, clusterColor, type GraphNodePos } from '@/core/graph/layout'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { EmptyStatePanel } from '@/components/ui/EmptyStatePanel'

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
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })

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
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    return runLayout(raw, canvasSize.w, canvasSize.h, 120)
  }, [raw, canvasSize])

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
      const mx = (a.x - cx + b.x - cx) / 2
      const my = (a.y - cy + b.y - cy) / 2
      const dx = b.x - a.x
      const dy = b.y - a.y
      const cpx = mx - dy * 0.15
      const cpy = my + dx * 0.15
      ctx.beginPath()
      ctx.moveTo(a.x - cx, a.y - cy)
      ctx.quadraticCurveTo(cpx, cpy, b.x - cx, b.y - cy)
      ctx.stroke()
    }

    for (const n of visibleRef.current) {
      const i = nodeIndex.get(n.node.path)!
      const color = clusterColor(currentLayout.clusters.get(i) ?? 0, isDarkRef.current)
      const linkCount = n.node.links.length
      const size = Math.min(10, Math.max(3, 3 + linkCount * 1.2))
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
        const label = n.node.title.length > 28 ? n.node.title.slice(0, 28) + '…' : n.node.title
        ctx.font = '11px system-ui, sans-serif'
        const tw = ctx.measureText(label).width
        const px = 6
        const py = 3
        const lx = n.x - cx - tw / 2 - px
        const ly = n.y - cy - size - 6 - 11 - py * 2
        const bw = tw + px * 2
        const bh = 11 + py * 2
        const br = 4
        ctx.fillStyle = isDarkRef.current ? 'rgba(24,24,27,0.92)' : 'rgba(255,255,255,0.92)'
        ctx.beginPath()
        ctx.moveTo(lx + br, ly)
        ctx.lineTo(lx + bw - br, ly)
        ctx.quadraticCurveTo(lx + bw, ly, lx + bw, ly + br)
        ctx.lineTo(lx + bw, ly + bh - br)
        ctx.quadraticCurveTo(lx + bw, ly + bh, lx + bw - br, ly + bh)
        ctx.lineTo(lx + br, ly + bh)
        ctx.quadraticCurveTo(lx, ly + bh, lx, ly + bh - br)
        ctx.lineTo(lx, ly + br)
        ctx.quadraticCurveTo(lx, ly, lx + br, ly)
        ctx.closePath()
        ctx.shadowColor = isDarkRef.current ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'
        ctx.shadowBlur = 6
        ctx.shadowOffsetY = 2
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
        ctx.fillStyle = isDarkRef.current ? '#e4e4e7' : '#27272a'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, n.x - cx, ly + bh / 2)
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'r' || e.key === 'R') {
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
      if (e.key === 'f' || e.key === 'F') {
        if (!layout) return
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const xs = layout.nodes.map((n) => n.x)
        const ys = layout.nodes.map((n) => n.y)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        const gw = maxX - minX + 80
        const gh = maxY - minY + 80
        const z = Math.min(rect.width / gw, rect.height / gh, 2)
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        setZoom(z)
        setPan({ x: -cx * z, y: -cy * z })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layout])

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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[13px] text-zinc-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
            <span>Building graph…</span>
          </div>
        )}
        {!loading && raw.length === 0 && (
          <EmptyStatePanel icon="◉" heading="No notes yet" description="Create some notes with links to see the graph." />
        )}
        <canvas ref={canvasRef} className="h-full w-full cursor-grab active:cursor-grabbing" />
        {!loading && raw.length > 0 && (
          <div
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] ${
              isDark ? 'bg-zinc-800/80 text-zinc-400' : 'bg-white/80 text-zinc-500'
            }`}
          >
            {statsMemo.nodes} nodes · {statsMemo.edges} edges
          </div>
        )}
      </div>
    </div>
  )
}