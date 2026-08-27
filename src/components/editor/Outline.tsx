import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useWorkspaceStore } from '@/stores/workspaceStore'

export interface HeadingEntry {
  id: number
  level: number
  text: string
  pos: number
}

function nodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'text') return n.text ?? ''
  if (Array.isArray(n.content)) return n.content.map(nodeText).join('')
  return ''
}

function walkNode(node: unknown, cur: number, out: HeadingEntry[]): number {
  if (!node || typeof node !== 'object') return 1
  const n = node as { type?: string; attrs?: { level?: number }; text?: string; content?: unknown[] }
  if (n.type === 'text') return (n.text ?? '').length
  if (n.type === 'heading') {
    const text = nodeText(n).trim()
    out.push({ id: cur, level: n.attrs?.level ?? 1, text: text || 'Untitled', pos: cur })
  }
  const kids = n.content ?? []
  if (kids.length === 0) return 1
  let offset = cur + 1
  for (const k of kids) offset += walkNode(k, offset, out)
  return offset - cur + 1
}

// oxlint-disable-next-line only-export-components — pure TOC builder shared with tests
export function collectHeadings(doc: unknown): HeadingEntry[] {
  const out: HeadingEntry[] = []
  const kids =
    doc && typeof doc === 'object'
      ? (doc as { content?: unknown[] }).content ?? []
      : []
  let offset = 0
  for (const k of kids) offset += walkNode(k, offset, out)
  return out
}

interface OutlineProps {
  editor: Editor | null
  scrollEl: HTMLDivElement | null
}

export function Outline({ editor, scrollEl }: OutlineProps) {
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'
  const [collapsed, setCollapsed] = useState(false)
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!editor) {
      // oxlint-disable-next-line set-state-in-effect — reset outline when editor unmounts
      setHeadings([])
      return
    }
    const refresh = () => setHeadings(collectHeadings(editor.getJSON()))
    // oxlint-disable-next-line set-state-in-effect — populate outline on editor create
    refresh()
    editor.on('update', refresh)
    editor.on('create', refresh)
    return () => {
      editor.off('update', refresh)
      editor.off('create', refresh)
    }
  }, [editor])

  useEffect(() => {
    if (!scrollEl || !editor) return
    const onScroll = () => {
      if (frame.current != null) return
      frame.current = requestAnimationFrame(() => {
        frame.current = null
        const rect = scrollEl.getBoundingClientRect()
        const top = rect.top + 8
        let active: number | null = null
        for (const h of collectHeadings(editor.getJSON())) {
          if (editor.view.coordsAtPos(h.pos).top <= top) active = h.id
        }
        setActiveId(active)
      })
    }
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      scrollEl.removeEventListener('scroll', onScroll)
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [scrollEl, editor])

  const scrollTo = (h: HeadingEntry) => {
    if (!scrollEl || !editor) return
    const rect = scrollEl.getBoundingClientRect()
    const y = editor.view.coordsAtPos(h.pos).top
    const docY = scrollEl.scrollTop + (y - rect.top)
    scrollEl.scrollTo({ top: Math.max(0, docY - 8), behavior: 'smooth' })
    setActiveId(h.id)
  }

  if (!editor || headings.length === 0) return null

  return (
    <div
      className={`flex h-full w-44 shrink-0 flex-col border-l ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className={`flex w-full items-center gap-1.5 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest transition-colors ${
          isDark ? 'text-zinc-500 hover:bg-zinc-800' : 'text-zinc-400 hover:bg-zinc-200'
        }`}
      >
        <span className={`text-[8px] transition-transform ${collapsed ? '' : 'rotate-90'}`}>▶</span>
        Outline
      </button>
      {!collapsed && (
        <nav aria-label="Table of contents" className="min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {headings.map((h) => (
              <li key={h.id} style={{ paddingLeft: (h.level - 1) * 10 }}>
                <button
                  onClick={() => scrollTo(h)}
                  title={h.text}
                  className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] transition-colors ${
                    activeId === h.id
                      ? isDark
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-blue-100 text-blue-700'
                      : isDark
                        ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'
                  }`}
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  )
}
