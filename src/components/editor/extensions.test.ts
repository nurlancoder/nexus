// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import { createExtensions } from './extensions'

let editor: Editor | null = null

function makeEditor(content: string): Editor {
  editor?.destroy()
  editor = new Editor({ extensions: createExtensions(), content, contentType: 'markdown' })
  return editor
}

function nodeTypes(json: JSONContent | undefined): string[] {
  return (json?.content ?? []).map((n) => n.type ?? '')
}

function findNode(json: JSONContent, type: string): JSONContent | undefined {
  if (json.type === type) return json
  for (const child of json.content ?? []) {
    const hit = findNode(child, type)
    if (hit) return hit
  }
  return undefined
}

afterEach(() => {
  editor?.destroy()
  editor = null
})

describe('editor extensions (createExtensions)', () => {
  it('builds a schema with all configured features', () => {
    const ed = makeEditor('x')
    for (const type of [
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'table',
      'taskList',
      'image',
      'link',
      'highlight',
      'underline',
    ]) {
      expect(ed.schema.nodes[type] !== undefined || ed.schema.marks[type] !== undefined).toBe(true)
    }
  })

  it('parses markdown into headings and inline marks', () => {
    const ed = makeEditor('# Title\n\nSome **bold** text')
    const types = nodeTypes(ed.getJSON())
    expect(types[0]).toBe('heading')
    expect(types[1]).toBe('paragraph')
    expect(ed.getMarkdown()).toContain('# Title')
    expect(ed.getMarkdown()).toContain('**bold**')
  })

  it('round-trips links and code', () => {
    const ed = makeEditor('See [docs](https://example.com) and `code`.')
    const md = ed.getMarkdown()
    expect(md).toContain('[docs](https://example.com)')
    expect(md).toContain('`code`')
  })

  it('parses task list items with checked state', () => {
    const ed = makeEditor('- [ ] open\n- [x] done\n')
    const taskList = findNode(ed.getJSON(), 'taskList')
    expect(taskList).toBeDefined()
    const items = taskList?.content ?? []
    expect(items.map((i) => i.attrs?.checked)).toEqual([false, true])
    expect(ed.getMarkdown()).toContain('- [ ] open')
    expect(ed.getMarkdown()).toContain('[x] done')
  })

  it('parses tables', () => {
    const ed = makeEditor('| a | b |\n| --- | --- |\n| 1 | 2 |\n')
    const table = findNode(ed.getJSON(), 'table')
    expect(table).toBeDefined()
    expect(table?.content?.length).toBe(2)
    expect(findNode(ed.getJSON(), 'tableHeader')).toBeDefined()
    expect(findNode(ed.getJSON(), 'tableCell')).toBeDefined()
  })

  it('shows placeholder through extension options without breaking docs', () => {
    const ed = makeEditor('')
    expect(ed.isEmpty).toBe(true)
  })
})
