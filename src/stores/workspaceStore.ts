import { create } from 'zustand'
import type { Workspace, FileNode } from '@/types'

export type Theme = 'light' | 'dark'

export const SIDEBAR_MIN = 180
export const SIDEBAR_MAX = 400
export const INSPECTOR_MIN = 220
export const INSPECTOR_MAX = 480

interface WorkspaceState {
  theme: Theme
  sidebarVisible: boolean
  inspectorVisible: boolean
  sidebarWidth: number
  inspectorWidth: number
  focusMode: boolean
  activeView: string
  workspace: Workspace | null
  fileTree: FileNode[]
  recentWorkspaces: Workspace[]
  workspaceLoading: boolean
  welcomeVisible: boolean
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  toggleInspector: () => void
  setSidebarWidth: (w: number) => void
  setInspectorWidth: (w: number) => void
  setFocusMode: (on: boolean) => void
  toggleFocusMode: () => void
  setActiveView: (view: string) => void
  activateWorkspace: (workspace: Workspace, fileTree: FileNode[]) => void
  closeWorkspace: () => void
  setFileTree: (fileTree: FileNode[]) => void
  setRecentWorkspaces: (list: Workspace[]) => void
  setWorkspaceLoading: (loading: boolean) => void
  setWelcomeVisible: (visible: boolean) => void
}

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

const rawTheme = localStorage.getItem('nexus.theme')
const storedTheme: Theme = rawTheme === 'light' || rawTheme === 'dark' ? rawTheme : 'dark'
const storedSidebarWidth = Number(localStorage.getItem('nexus.sidebarWidth')) || 208
const storedInspectorWidth =
  Number(localStorage.getItem('nexus.inspectorWidth')) || 256
const storedFocusMode = localStorage.getItem('nexus.focusMode') === '1'

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  theme: storedTheme,
  sidebarVisible: true,
  inspectorVisible: true,
  sidebarWidth: storedSidebarWidth,
  inspectorWidth: storedInspectorWidth,
  focusMode: storedFocusMode,
  activeView: 'inbox',
  workspace: null,
  fileTree: [],
  recentWorkspaces: [],
  workspaceLoading: false,
  welcomeVisible: false,
  setTheme: (theme) => {
    applyTheme(theme)
    localStorage.setItem('nexus.theme', theme)
    set({ theme })
  },
  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleInspector: () => set((s) => ({ inspectorVisible: !s.inspectorVisible })),
  setSidebarWidth: (w) => {
    const width = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, w))
    localStorage.setItem('nexus.sidebarWidth', String(width))
    set({ sidebarWidth: width })
  },
  setInspectorWidth: (w) => {
    const width = Math.min(INSPECTOR_MAX, Math.max(INSPECTOR_MIN, w))
    localStorage.setItem('nexus.inspectorWidth', String(width))
    set({ inspectorWidth: width })
  },
  setActiveView: (view) => set({ activeView: view }),
  setFocusMode: (on) => {
    localStorage.setItem('nexus.focusMode', on ? '1' : '0')
    set({ focusMode: on })
  },
  toggleFocusMode: () => {
    const on = !get().focusMode
    localStorage.setItem('nexus.focusMode', on ? '1' : '0')
    set({ focusMode: on })
  },
  activateWorkspace: (workspace, fileTree) =>
    set({
      workspace,
      fileTree,
      welcomeVisible: false,
      activeView: 'inbox',
    }),
  closeWorkspace: () =>
    set({ workspace: null, fileTree: [], activeView: 'inbox' }),
  setFileTree: (fileTree) => set({ fileTree }),
  setRecentWorkspaces: (recentWorkspaces) => set({ recentWorkspaces }),
  setWorkspaceLoading: (workspaceLoading) => set({ workspaceLoading }),
  setWelcomeVisible: (welcomeVisible) => set({ welcomeVisible }),
}))

applyTheme(storedTheme)