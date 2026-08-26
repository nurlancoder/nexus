export interface CanvasNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  text: string
  groupId?: string
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
}

export interface CanvasGroup {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

export interface CanvasViewport {
  x: number
  y: number
  zoom: number
}

export interface CanvasData {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  groups: CanvasGroup[]
  viewport: CanvasViewport
}

export function emptyCanvas(): CanvasData {
  return { nodes: [], edges: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

let idCounter = 0
export function uid(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

export function pointInRect(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h
}

export function normalizeCanvas(data: unknown): CanvasData {
  const d = (data ?? {}) as Partial<CanvasData>
  return {
    nodes: Array.isArray(d.nodes) ? (d.nodes as CanvasNode[]) : [],
    edges: Array.isArray(d.edges) ? (d.edges as CanvasEdge[]) : [],
    groups: Array.isArray(d.groups) ? (d.groups as CanvasGroup[]) : [],
    viewport: {
      x: d.viewport?.x ?? 0,
      y: d.viewport?.y ?? 0,
      zoom: d.viewport?.zoom ?? 1,
    },
  }
}