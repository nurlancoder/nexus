export interface Workspace {
  id: number
  name: string
  path: string
  createdAt: string
  lastOpenedAt: string | null
}

export interface FileNode {
  name: string
  path: string
  isDir: boolean
  children: FileNode[]
}
