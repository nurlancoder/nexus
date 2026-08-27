import { describe, it, expect } from 'vitest'
import { collectHeadings } from './Outline'

describe('collectHeadings (TOC builder)', () => {
  it('returns ordered headings with level, text and position', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sub' }] },
      ],
    }
    const hs = collectHeadings(doc)
    expect(hs).toHaveLength(2)
    expect(hs[0]).toMatchObject({ level: 1, text: 'Title', pos: 0 })
    expect(hs[1]).toMatchObject({ level: 2, text: 'Sub' })
    expect(hs[1].pos).toBeGreaterThan(hs[0].pos)
  })

  it('preserves nested heading levels (1..6) and indentation signal', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'A' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'B' }] },
        { type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'C' }] },
      ],
    }
    const hs = collectHeadings(doc)
    expect(hs.map((h) => h.level)).toEqual([1, 3, 6])
    expect(hs.map((h) => h.pos)).toEqual([0, expect.any(Number), expect.any(Number)])
    expect(hs[2].pos).toBeGreaterThan(hs[1].pos)
  })

  it('finds headings nested inside blockquote/list nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'blockquote', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Quote Head' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'heading', attrs: { level: 4 }, content: [{ type: 'text', text: 'List Head' }] }] }] },
      ],
    }
    const hs = collectHeadings(doc)
    expect(hs.map((h) => h.text)).toEqual(['Quote Head', 'List Head'])
    expect(hs.map((h) => h.level)).toEqual([2, 4])
  })

  it('uses Untitled when a heading has no text', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'heading', attrs: { level: 1 }, content: [] }],
    }
    const hs = collectHeadings(doc)
    expect(hs).toHaveLength(1)
    expect(hs[0].text).toBe('Untitled')
  })

  it('returns empty array for a doc with no headings', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'plain' }] }] }
    expect(collectHeadings(doc)).toEqual([])
  })

  it('computes positions consistent with ProseMirror node sizes', () => {
    // "Alpha" (5 chars, size 7) then a 3-char paragraph (size 5) then "Beta"
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Alpha' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'abc' }] },
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Beta' }] },
      ],
    }
    const hs = collectHeadings(doc)
    // Alpha starts at 0; Beta starts after Alpha(7) + paragraph(1+3+1=5)
    expect(hs[0].pos).toBe(0)
    expect(hs[1].pos).toBe(12)
  })
})
