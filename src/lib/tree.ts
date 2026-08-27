import type { FileNode } from '@/types'

export function collectDirs(nodes: FileNode[], base = ''): string[] {
  const dirs: string[] = []
  for (const n of nodes) {
    if (n.isDir) {
      const name = base ? `${base}/${n.name}` : n.name
      dirs.push(name)
      dirs.push(...collectDirs(n.children, name))
    }
  }
  return dirs
}
