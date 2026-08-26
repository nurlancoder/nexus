import type { Workspace, FileNode } from '@/types'

const fakeWorkspace: Workspace = {
  id: 1,
  name: 'Demo Workspace',
  path: '/demo/workspace',
  createdAt: new Date().toISOString(),
  lastOpenedAt: new Date().toISOString(),
}

export const browserWorkspaceApi = {
  create: async (_name: string, _parentPath: string): Promise<Workspace> => ({
    ...fakeWorkspace,
    name: _name,
    path: `${_parentPath}/${_name}`,
  }),
  open: async (_path: string): Promise<Workspace> => ({
    ...fakeWorkspace,
    path: _path,
    name: _path.split('/').pop() ?? 'Workspace',
  }),
  recent: async (): Promise<Workspace[]> => [],
  tree: async (_path: string): Promise<FileNode[]> => [],
}

export function throwBrowserError(api: string): never {
  throw new Error(`"${api}" is not available in browser mode — requires Tauri`)
}
