import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { SlashMenu } from './SlashMenu'
import { LinkMenu } from './LinkMenu'
import { unescapeWikiLinks } from '@/core/parser/markdown'

interface RichTextEditorProps {
  initialContent: string
  onChange: (markdown: string) => void
  readOnly?: boolean
}

export function RichTextEditor({ initialContent, onChange, readOnly = false }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: createExtensions(),
    content: initialContent,
    contentType: 'markdown',
    editable: !readOnly,
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor }) =>
      onChangeRef.current(unescapeWikiLinks(editor.getMarkdown())),
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  })

  const wordCount = useMemo(() => {
    if (!editor) return 0
    const text = editor.getText().trim()
    if (!text) return 0
    return text.split(/\s+/).length
  }, [editor])

  return (
    <div className="relative flex h-full flex-col">
      {!readOnly && <EditorToolbar editor={editor} />}
      {readOnly && (
        <div className="flex h-7 shrink-0 items-center border-b bg-zinc-100 px-3 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Read-only</span>
        </div>
      )}
      <div
        className={`min-h-0 flex-1 overflow-y-auto bg-zinc-50 transition-shadow dark:bg-zinc-950 ${
          isFocused ? 'ring-1 ring-inset ring-blue-500/20' : ''
        }`}
      >
        <EditorContent editor={editor} />
      </div>
      <SlashMenu editor={editor} />
      <LinkMenu editor={editor} />
      {editor && (
        <div className="absolute bottom-2 right-3 text-[10px] text-zinc-400 dark:text-zinc-600 select-none">
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </div>
      )}
    </div>
  )
}

export type { Editor }