import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import { createExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { SlashMenu } from './SlashMenu'
import { LinkMenu } from './LinkMenu'
import { unescapeWikiLinks } from '@/core/parser/markdown'

interface RichTextEditorProps {
  initialContent: string
  onChange: (markdown: string) => void
}

export function RichTextEditor({ initialContent, onChange }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    extensions: createExtensions(),
    content: initialContent,
    contentType: 'markdown',
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor }) =>
      onChangeRef.current(unescapeWikiLinks(editor.getMarkdown())),
  })

  return (
    <div className="relative flex h-full flex-col">
      <EditorToolbar editor={editor} />
      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
        <EditorContent editor={editor} />
      </div>
      <SlashMenu editor={editor} />
      <LinkMenu editor={editor} />
    </div>
  )
}

export type { Editor }