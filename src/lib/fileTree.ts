import type { FileNode } from '@/types'
import { basename } from '@/lib/paths'

const MARKDOWN_RE = /\.(md|markdown|txt)$/i

export interface MdFile {
  path: string
  name: string
  title: string
  dir: string
}

export function isMarkdown(name: string): boolean {
  return MARKDOWN_RE.test(name)
}

export function markdownTitle(path: string): string {
  return basename(path).replace(MARKDOWN_RE, '').replace(/_/g, ' ')
}

export function flattenMdFiles(tree: FileNode[]): MdFile[] {
  const out: MdFile[] = []
  const walk = (nodes: FileNode[], parentDir: string) => {
    for (const node of nodes) {
      if (node.isDir) {
        walk(node.children, node.path)
      } else if (isMarkdown(node.name)) {
        out.push({
          path: node.path,
          name: node.name,
          title: markdownTitle(node.path),
          dir: parentDir,
        })
      }
    }
  }
  walk(tree, '')
  return out
}
