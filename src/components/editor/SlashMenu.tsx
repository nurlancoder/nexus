import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'

interface SlashCommand {
  title: string
  keywords: string[]
  icon: string
  run: (editor: Editor) => void
}

const COMMANDS: SlashCommand[] = [
  { title: 'Paragraph', keywords: ['p'], icon: '¶', run: (e) => e.chain().focus().setParagraph().run() },
  { title: 'Heading 1', keywords: ['h1'], icon: 'H1', run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', keywords: ['h2'], icon: 'H2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', keywords: ['h3'], icon: 'H3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: 'Bold', keywords: ['b'], icon: 'B', run: (e) => e.chain().focus().toggleBold().run() },
  { title: 'Italic', keywords: ['i'], icon: 'I', run: (e) => e.chain().focus().toggleItalic().run() },
  { title: 'Bullet list', keywords: ['list', 'ul'], icon: '•', run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: 'Numbered list', keywords: ['list', 'ol'], icon: '1.', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: 'Task list', keywords: ['todo', 'checkbox'], icon: '☑', run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: 'Quote', keywords: ['quote', 'blockquote'], icon: '❝', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: 'Code block', keywords: ['code'], icon: '{ }', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: 'Table', keywords: ['table'], icon: '⊞', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Divider', keywords: ['hr', 'rule'], icon: '—', run: (e) => e.chain().focus().setHorizontalRule().run() },
  {
    title: 'Link',
    keywords: ['url'],
    icon: '🔗',
    run: (e) => {
      const url = window.prompt('Link URL:')
      if (url) e.chain().focus().setLink({ href: url }).run()
      else e.chain().focus().unsetLink().run()
    },
  },
  {
    title: 'Internal link',
    keywords: ['wikilink', 'link'],
    icon: '[[',
    run: (e) => {
      const from = e.state.selection.from
      e.chain().focus().insertContent('[[]]').run()
      e.commands.setTextSelection(from + 2)
    },
  },
  {
    title: 'Image',
    keywords: ['img', 'picture'],
    icon: '🖼',
    run: (e) => {
      const url = window.prompt('Image URL:')
      if (url) e.chain().focus().setImage({ src: url }).run()
    },
  },
]

interface SlashState {
  query: string
  top: number
  left: number
  from: number
  to: number
}

export function SlashMenu({ editor }: { editor: Editor | null }) {
  const [state, setState] = useState<SlashState | null>(null)
  const [selected, setSelected] = useState(0)

  const filtered = useMemo(
    () =>
      state
        ? COMMANDS.filter((c) => {
            const q = state.query.toLowerCase()
            if (!q) return true
            return (
              c.title.toLowerCase().includes(q) ||
              c.keywords.some((k) => k.includes(q))
            )
          })
        : [],
    [state],
  )

  const runCommand = useCallback(
    (cmd: SlashCommand) => {
      if (!editor || !state) return
      editor.chain().focus().deleteRange({ from: state.from, to: state.to }).run()
      cmd.run(editor)
      setState(null)
    },
    [editor, state],
  )

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const { $from } = editor.state.selection
      if (!$from) return setState(null)
      const parent = $from.parent
      if (parent.type.name !== 'paragraph') return setState(null)
      const textBefore = parent.textBetween(0, $from.parentOffset, undefined, '\ufffc')
      const match = textBefore.match(/(^|\s)\/([a-zA-Z]*)$/)
      if (!match) return setState(null)
      const coords = editor.view.coordsAtPos($from.pos)
      const slashStart = $from.pos - match[2].length - 1
      setState({
        query: match[2],
        top: coords.top,
        left: coords.left,
        from: slashStart,
        to: $from.pos,
      })
    }
    editor.on('transaction', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('transaction', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  useEffect(() => {
    if (!state || filtered.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => (s + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => (s - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[selected]
        if (cmd) runCommand(cmd)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setState(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, filtered, selected, runCommand])

  if (!state || filtered.length === 0) return null

  return (
    <div
      className="fixed z-40 max-h-72 w-56 overflow-y-auto rounded-lg border bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ top: state.top + 24, left: Math.max(12, state.left) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.title}
          onMouseEnter={() => setSelected(i)}
          onClick={() => runCommand(cmd)}
          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] ${
            i === selected
              ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              : 'text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <span className="w-5 text-center text-[12px]">{cmd.icon}</span>
          {cmd.title}
        </button>
      ))}
    </div>
  )
}