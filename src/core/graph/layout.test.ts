import { describe, it, expect } from 'vitest'
import { computeClusters, runLayout, clusterColor } from './layout'
import type { GraphNode } from '@/core/filesystem/api'

function node(path: string, title: string, links: string[]): GraphNode {
  return { path, title, tags: [], links }
}

describe('computeClusters', () => {
  it('groups connected components', () => {
    const nodes: ReturnType<typeof runLayout>['nodes'] = [
      { node: node('/a', 'A', []), x: 0, y: 0, vx: 0, vy: 0 },
      { node: node('/b', 'B', []), x: 0, y: 0, vx: 0, vy: 0 },
      { node: node('/c', 'C', []), x: 0, y: 0, vx: 0, vy: 0 },
      { node: node('/d', 'D', []), x: 0, y: 0, vx: 0, vy: 0 },
    ]
    const edges = [
      { source: 0, target: 1 },
      { source: 2, target: 3 },
    ]
    const clusters = computeClusters(nodes, edges)
    expect(clusters.get(0)).toBe(clusters.get(1))
    expect(clusters.get(2)).toBe(clusters.get(3))
    expect(clusters.get(0)).not.toBe(clusters.get(2))
  })
})

describe('runLayout', () => {
  it('creates nodes and edges, resolves links only to existing paths', () => {
    const a = node('/a.md', 'A', ['/b.md', '/missing.md'])
    const b = node('/b.md', 'B', [])
    const layout = runLayout([a, b], 800, 600, 10)
    expect(layout.nodes).toHaveLength(2)
    expect(layout.edges).toHaveLength(1)
    expect(layout.edges[0]).toEqual({ source: 0, target: 1 })
  })

  it('does not duplicate undirected edges', () => {
    const a = node('/a.md', 'A', ['/b.md'])
    const b = node('/b.md', 'B', ['/a.md'])
    const layout = runLayout([a, b], 800, 600, 10)
    expect(layout.edges).toHaveLength(1)
  })

  it('keeps nodes finite after simulation', () => {
    const nodes = Array.from({ length: 12 }, (_, i) =>
      node(`/n${i}.md`, `N${i}`, i > 0 ? [`/n${i - 1}.md`] : []),
    )
    const layout = runLayout(nodes, 800, 600, 20)
    for (const n of layout.nodes) {
      expect(Number.isFinite(n.x)).toBe(true)
      expect(Number.isFinite(n.y)).toBe(true)
    }
  })
})

describe('clusterColor', () => {
  it('returns a color for any cluster index', () => {
    expect(clusterColor(0, true)).toMatch(/^#[0-9a-f]{6}$/i)
    expect(clusterColor(7, true)).toMatch(/^#[0-9a-f]{6}$/i)
    expect(clusterColor(0, false)).toMatch(/^#[0-9a-f]{6}$/i)
  })
})