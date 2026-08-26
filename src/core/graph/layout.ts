import type { GraphNode } from '@/core/filesystem/api'

export interface GraphNodePos {
  node: GraphNode
  x: number
  y: number
  vx: number
  vy: number
}

export interface GraphLayout {
  nodes: GraphNodePos[]
  edges: { source: number; target: number }[]
  clusters: Map<number, number>
  clusterCount: number
}

export function computeClusters(
  nodes: GraphNodePos[],
  edges: { source: number; target: number }[],
): Map<number, number> {
  const adj: number[][] = nodes.map(() => [])
  for (const e of edges) {
    adj[e.source].push(e.target)
    adj[e.target].push(e.source)
  }
  const cluster = new Map<number, number>()
  let next = 0
  const visited = new Set<number>()
  for (let i = 0; i < nodes.length; i++) {
    if (visited.has(i)) continue
    const queue = [i]
    visited.add(i)
    while (queue.length > 0) {
      const cur = queue.shift()!
      cluster.set(cur, next)
      for (const nb of adj[cur]) {
        if (!visited.has(nb)) {
          visited.add(nb)
          queue.push(nb)
        }
      }
    }
    next++
  }
  return cluster
}

export function runLayout(
  raw: GraphNode[],
  width: number,
  height: number,
  iterations = 120,
): GraphLayout {
  const nodes: GraphNodePos[] = raw.map((n) => ({
    node: n,
    x: (Math.random() - 0.5) * width,
    y: (Math.random() - 0.5) * height,
    vx: 0,
    vy: 0,
  }))
  const index = new Map(nodes.map((n, i) => [n.node.path, i]))

  const edges: { source: number; target: number }[] = []
  const seen = new Set<string>()
  for (const n of nodes) {
    for (const targetPath of n.node.links) {
      const t = index.get(targetPath)
      if (t === undefined) continue
      const s = index.get(n.node.path)!
      const key = s < t ? `${s}:${t}` : `${t}:${s}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ source: s, target: t })
    }
  }

  const k = Math.sqrt((width * height) / Math.max(1, nodes.length))
  const C = 0.01
  const dt = 0.09
  const DAMPING = 0.85

  for (let iter = 0; iter < iterations; iter++) {
    const reps: number[] = new Array(nodes.length).fill(0)
    const repX: number[] = new Array(nodes.length).fill(0)
    const repY: number[] = new Array(nodes.length).fill(0)

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const d2 = Math.max(dx * dx + dy * dy, 0.01)
        const d = Math.sqrt(d2)
        const f = (C * k * k) / d
        const fx = (dx / d) * f
        const fy = (dy / d) * f
        repX[i] -= fx
        repY[i] -= fy
        repX[j] += fx
        repY[j] += fy
        reps[i] += 1
        reps[j] += 1
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      n.vx += repX[i] * dt
      n.vy += repY[i] * dt
      n.vx *= DAMPING
      n.vy *= DAMPING
      n.x += n.vx
      n.y += n.vy
      const l = Math.hypot(n.x, n.y)
      const max = Math.min(width, height) / 2 - 30
      if (l > max) {
        n.x *= max / l
        n.y *= max / l
      }
    }

    if (edges.length > 0) {
      for (const e of edges) {
        const a = nodes[e.source]
        const b = nodes[e.target]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.max(Math.hypot(dx, dy), 0.01)
        const ideal = k
        const f = (dist - ideal) * 0.08
        const fx = (dx / dist) * f
        const fy = (dy / dist) * f
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
    }

    if (nodes.length > 0) {
      const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length
      const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length
      for (const n of nodes) {
        n.x += (0 - cx) * 0.01
        n.y += (0 - cy) * 0.01
      }
    }
  }

  const clusters = computeClusters(nodes, edges)
  return {
    nodes,
    edges,
    clusters,
    clusterCount: new Set(clusters.values()).size,
  }
}

const CLUSTER_COLORS = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
  '#f472b6',
  '#22d3ee',
  '#fb923c',
]

export function clusterColor(c: number, isDark: boolean): string {
  if (!isDark) {
    return ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c'][c % 8]
  }
  return CLUSTER_COLORS[c % CLUSTER_COLORS.length]
}