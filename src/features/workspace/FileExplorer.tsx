import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useNoteStore } from '@/stores/noteStore'
import { noteApi, canvasApi } from '@/core/filesystem/api'
import { refreshTree } from '@/features/notes/actions'
import { dirname, basename } from '@/lib/paths'
import { pickDirectory } from '@/lib/dialog'
import type { FileNode } from '@/types'

interface MenuState {
  x: number
  y: number
  node: FileNode | null
}

const MARKDOWN_RE = /\.(md|markdown|txt)$/i
const CANVAS_RE = /\.canvas$/i

interface TreeItemProps {
  node: FileNode
  depth: number
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
}

function TreeItem({ node, depth, onContextMenu }: TreeItemProps) {
  const theme = useWorkspaceStore((s) => s.theme)
  const [expanded, setExpanded] = useState(node.isDir && depth === 0)
  const openNote = useTabStore((s) => s.openNote)
  const openCanvas = useTabStore((s) => s.openCanvas)
  const isDark = theme === 'dark'

  const isMarkdown = !node.isDir && MARKDOWN_RE.test(node.name)
  const isCanvas = !node.isDir && CANVAS_RE.test(node.name)

  return (
    <div>
      <button
        onContextMenu={(e) => onContextMenu(e, node)}
        onClick={() => {
          if (node.isDir) setExpanded((e) => !e)
          else if (isMarkdown) openNote(node.path, node.name.replace(MARKDOWN_RE, ''))
          else if (isCanvas) openCanvas(node.path, node.name.replace(CANVAS_RE, ''))
        }}
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12px] transition-colors ${
          isDark
            ? 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
            : 'text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span
          className={`w-3 shrink-0 text-center text-[9px] ${
            isDark ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          {node.isDir ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="shrink-0 text-[12px]">
          {node.isDir ? '📁' : isCanvas ? '◇' : isMarkdown ? '📄' : '🔗'}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
      {node.isDir &&
        expanded &&
        node.children.map((child) => (
          <TreeItem key={child.path} node={child} depth={depth + 1} onContextMenu={onContextMenu} />
        ))}
    </div>
  )
}

export function FileExplorer() {
  const { fileTree } = useWorkspaceStore()
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'
  const [menu, setMenu] = useState<MenuState | null>(null)

  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('blur', close)
    }
  }, [])

  const onContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node })
  }

  const runAction = async (action: string) => {
    if (!menu) return
    const node = menu.node
    setMenu(null)
    const tabs = useTabStore.getState()
    const notes = useNoteStore.getState()

    if (action === 'new') {
      const parent = node?.isDir ? node.path : (node ? dirname(node.path) : null)
      if (!parent) return
      const name = window.prompt('Note title:', 'Untitled')
      if (name === null) return
      try {
        const path = await noteApi.create(parent, name)
        await refreshTree()
        tabs.openNote(path, name || 'Untitled')
      } catch (e) {
        window.alert(String(e))
      }
    } else if (action === 'newCanvas') {
      const parent = node?.isDir ? node.path : (node ? dirname(node.path) : null)
      if (!parent) return
      const name = window.prompt('Canvas name:', 'Untitled')
      if (name === null) return
      try {
        const path = await canvasApi.create(parent, name)
        await refreshTree()
        tabs.openCanvas(path, name || 'Untitled')
      } catch (e) {
        window.alert(String(e))
      }
    } else if (node && action === 'rename') {
      const stem = node.name.replace(MARKDOWN_RE, '')
      const newName = window.prompt('New name:', stem)
      if (newName === null || !newName.trim() || newName.trim() === stem) return
      try {
        const newPath = await noteApi.rename(node.path, newName.trim())
        await refreshTree()
        tabs.updateNoteTab(node.path, newPath, newName.trim())
        notes.close(node.path)
      } catch (e) {
        window.alert(String(e))
      }
    } else if (node && action === 'duplicate') {
      try {
        const newPath = await noteApi.duplicate(node.path)
        await refreshTree()
        tabs.openNote(newPath, basename(newPath).replace(MARKDOWN_RE, ''))
      } catch (e) {
        window.alert(String(e))
      }
    } else if (node && action === 'delete') {
      if (!window.confirm(`Delete "${node.name}"?`)) return
      try {
        await noteApi.remove(node.path)
        await refreshTree()
        tabs.closeTab(`note:${node.path}`)
        notes.close(node.path)
      } catch (e) {
        window.alert(String(e))
      }
    } else if (node && action === 'move') {
      const target = await pickDirectory('Choose destination folder')
      if (!target) return
      try {
        const newPath = await noteApi.move(node.path, target)
        await refreshTree()
        tabs.updateNoteTab(node.path, newPath, node.name.replace(MARKDOWN_RE, ''))
        notes.close(node.path)
      } catch (e) {
        window.alert(String(e))
      }
    }
  }

  if (fileTree.length === 0) {
    return (
      <p className={`px-3 py-1 text-[12px] ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        Empty workspace
      </p>
    )
  }

  const menuItem = (label: string, action: string) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        void runAction(action)
      }}
      className={`block w-full px-3 py-1.5 text-left text-[12px] ${
        isDark ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 hover:bg-zinc-100'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="space-y-0.5">
        {fileTree.map((node) => (
          <TreeItem key={node.path} node={node} depth={0} onContextMenu={onContextMenu} />
        ))}
      </div>

      {menu && (
        <div
          className={`fixed z-50 min-w-40 rounded-lg border py-1 shadow-xl ${
            isDark
              ? 'border-zinc-700 bg-zinc-900'
              : 'border-zinc-200 bg-white'
          }`}
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuItem('New note', 'new')}
          {menuItem('New canvas', 'newCanvas')}
          {menu.node && !menu.node.isDir && (
            <>
              <div
                className={`my-1 h-px ${isDark ? 'bg-zinc-800' : 'bg-zinc-100'}`}
              />
              {menuItem('Rename', 'rename')}
              {menuItem('Duplicate', 'duplicate')}
              {menuItem('Move…', 'move')}
              {menuItem('Delete', 'delete')}
            </>
          )}
        </div>
      )}
    </div>
  )
}