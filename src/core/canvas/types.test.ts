import { describe, it, expect } from 'vitest'
import { emptyCanvas, normalizeCanvas, pointInRect, uid } from './types'

describe('canvas types', () => {
  it('creates empty canvas', () => {
    const c = emptyCanvas()
    expect(c.nodes).toEqual([])
    expect(c.edges).toEqual([])
    expect(c.groups).toEqual([])
    expect(c.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('normalizes partial or malformed data', () => {
    expect(normalizeCanvas(null).nodes).toEqual([])
    expect(normalizeCanvas(undefined).groups).toEqual([])
    const d = normalizeCanvas({
      nodes: [{ id: 'n1', x: 1, y: 2, w: 3, h: 4, text: 'hi' }],
      viewport: { x: 10, y: 20, zoom: 0.5 },
    })
    expect(d.nodes).toHaveLength(1)
    expect(d.viewport).toEqual({ x: 10, y: 20, zoom: 0.5 })
    expect(d.edges).toEqual([])
  })

  it('detects point in rect', () => {
    expect(pointInRect(5, 5, 0, 0, 10, 10)).toBe(true)
    expect(pointInRect(11, 5, 0, 0, 10, 10)).toBe(false)
    expect(pointInRect(5, 11, 0, 0, 10, 10)).toBe(false)
  })

  it('generates unique ids', () => {
    expect(uid('node')).not.toBe(uid('node'))
  })
})