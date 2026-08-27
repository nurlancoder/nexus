import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { createExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { SlashMenu } from './SlashMenu'
import { LinkMenu } from './LinkMenu'
import { unescapeWikiLinks } from '@/core/parser/markdown'

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

interface RichTextEditorProps {
  initialContent: string
  onChange: (markdown: string) => void
  readOnly?: boolean
  registerEditor?: (editor: Editor | null) => void
  registerScrollEl?: (el: HTMLDivElement | null) => void
}

export function RichTextEditor({
  initialContent,
  onChange,
  readOnly = false,
  registerEditor,
  registerScrollEl,
}: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)
  const [isFocused, setIsFocused] = useState(false)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const scrollEl = useRef<HTMLDivElement>(null)
  useEffect(() => {
    registerScrollEl?.(scrollEl.current)
    return () => registerScrollEl?.(null)
  }, [registerScrollEl])

  const editor = useEditor({
    extensions: createExtensions(),
    content: initialContent,
    contentType: 'markdown',
    editable: !readOnly,
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(unescapeWikiLinks(editor.getMarkdown()))
      setWordCount(countWords(editor.getText()))
    },
    onCreate: ({ editor }) => {
      setWordCount(countWords(editor.getText()))
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  })

  useEffect(() => {
    registerEditor?.(editor)
    return () => registerEditor?.(null)
  }, [editor, registerEditor])

  return (
    <div className="relative flex h-full flex-col">
      {!readOnly && <EditorToolbar editor={editor} />}
      {readOnly && (
        <div className="flex h-7 shrink-0 items-center border-b bg-zinc-100 px-3 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">Read-only</span>
        </div>
      )}
      <div
        ref={scrollEl}
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