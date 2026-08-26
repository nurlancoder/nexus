export interface FileInfo {
  path: string
  title: string
  type: string
  size: number
  modifiedAt: string
}

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

export interface DbResult<T> {
  ok: boolean
  data?: T
  error?: string
}