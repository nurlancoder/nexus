import { useEditorState } from '@tiptap/react'
import type { Editor } from '@tiptap/react'

interface ToolbarButton {
  label: string
  title: string
  shortcut?: string
  action: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
  dividerBefore?: boolean
}

interface ToolbarState {
  paragraph: boolean
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  highlight: boolean
  code: boolean
  h1: boolean
  h2: boolean
  h3: boolean
  bullet: boolean
  ordered: boolean
  task: boolean
  quote: boolean
  codeBlock: boolean
  link: boolean
}

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  const state = useEditorState<ToolbarState | null>({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null
      return {
        paragraph: editor.isActive('paragraph'),
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        highlight: editor.isActive('highlight'),
        code: editor.isActive('code'),
        h1: editor.isActive('heading', { level: 1 }),
        h2: editor.isActive('heading', { level: 2 }),
        h3: editor.isActive('heading', { level: 3 }),
        bullet: editor.isActive('bulletList'),
        ordered: editor.isActive('orderedList'),
        task: editor.isActive('taskList'),
        quote: editor.isActive('blockquote'),
        codeBlock: editor.isActive('codeBlock'),
        link: editor.isActive('link'),
      }
    },
  })

  if (!editor || !state) return null

  const isActiveFor = (b: ToolbarButton) => (b.isActive ? b.isActive(editor) : false)

  const buttons: ToolbarButton[] = [
    { label: 'P', title: 'Paragraph', shortcut: '', isActive: () => state.paragraph, action: (e) => e.chain().focus().setParagraph().run() },
    { label: 'H1', title: 'Heading 1', shortcut: '', isActive: () => state.h1, action: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'H2', title: 'Heading 2', shortcut: '', isActive: () => state.h2, action: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'H3', title: 'Heading 3', shortcut: '', isActive: () => state.h3, action: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'B', title: 'Bold', shortcut: 'Ctrl+B', dividerBefore: true, isActive: () => state.bold, action: (e) => e.chain().focus().toggleBold().run() },
    { label: 'I', title: 'Italic', shortcut: 'Ctrl+I', isActive: () => state.italic, action: (e) => e.chain().focus().toggleItalic().run() },
    { label: 'U', title: 'Underline', shortcut: 'Ctrl+U', isActive: () => state.underline, action: (e) => e.chain().focus().toggleUnderline().run() },
    { label: 'S', title: 'Strikethrough', shortcut: 'Ctrl+Shift+X', isActive: () => state.strike, action: (e) => e.chain().focus().toggleStrike().run() },
    { label: 'Hl', title: 'Highlight', shortcut: 'Ctrl+Shift+H', isActive: () => state.highlight, action: (e) => e.chain().focus().toggleHighlight().run() },
    { label: '`', title: 'Inline code', shortcut: 'Ctrl+E', isActive: () => state.code, action: (e) => e.chain().focus().toggleCode().run() },
    { label: '•', title: 'Bullet list', shortcut: 'Ctrl+Shift+8', dividerBefore: true, isActive: () => state.bullet, action: (e) => e.chain().focus().toggleBulletList().run() },
    { label: '1.', title: 'Numbered list', shortcut: 'Ctrl+Shift+7', isActive: () => state.ordered, action: (e) => e.chain().focus().toggleOrderedList().run() },
    { label: '☑', title: 'Task list', shortcut: '', isActive: () => state.task, action: (e) => e.chain().focus().toggleTaskList().run() },
    { label: '❝', title: 'Quote', shortcut: 'Ctrl+Shift+B', isActive: () => state.quote, action: (e) => e.chain().focus().toggleBlockquote().run() },
    { label: '{ }', title: 'Code block', shortcut: 'Ctrl+Alt+C', dividerBefore: true, isActive: () => state.codeBlock, action: (e) => e.chain().focus().toggleCodeBlock().run() },
    { label: '⊞', title: 'Table', shortcut: '', dividerBefore: true, action: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: '—', title: 'Horizontal rule', shortcut: '', action: (e) => e.chain().focus().setHorizontalRule().run() },
    {
      label: '🔗',
      title: 'Link',
      shortcut: 'Ctrl+K',
      isActive: () => state.link,
      action: (e) => {
        const url = window.prompt('Link URL:')
        if (url) e.chain().focus().setLink({ href: url }).run()
        else e.chain().focus().unsetLink().run()
      },
    },
    {
      label: '[[',
      title: 'Internal link',
      shortcut: '',
      action: (e) => {
        const from = e.state.selection.from
        e.chain().focus().insertContent('[[]]').run()
        e.commands.setTextSelection(from + 2)
      },
    },
  ]

  return (
    <div className="flex h-9 shrink-0 flex-wrap items-center gap-0.5 border-b bg-zinc-100 px-2 dark:border-zinc-800 dark:bg-zinc-900" role="toolbar" aria-label="Formatting">
      {buttons.map((b) => {
        const tooltipText = b.shortcut ? `${b.title} (${b.shortcut})` : b.title
        return (
          <span key={b.title} className="flex items-center">
            {b.dividerBefore && <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />}
            <button
              title={tooltipText}
              aria-label={tooltipText}
              aria-pressed={isActiveFor(b)}
              onClick={() => b.action(editor)}
              className={`rounded px-1.5 py-1 text-[12px] leading-none transition-colors ${
                isActiveFor(b)
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {b.label}
            </button>
          </span>
        )
      })}
    </div>
  )
}