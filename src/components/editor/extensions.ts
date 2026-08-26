import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import {
  Table,
  TableRow,
  TableHeader,
  TableCell,
} from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import type { AnyExtension } from '@tiptap/core'

export function createExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({ link: false, underline: false }),
    Underline,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
    Image,
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({ placeholder: 'Start writing…' }),
    Markdown,
  ]
}