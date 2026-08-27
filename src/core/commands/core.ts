import { commands } from '@/core/commands/registry'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useShortcutsStore } from '@/stores/shortcutsStore'
import { createNoteInInbox } from '@/features/notes/actions'
import { applyLayoutPreset } from '@/core/layout/presets'
import { checkForUpdates } from '@/lib/updater'
import { showInfo } from '@/lib/dialog'
import { noteApi } from '@/core/filesystem/api'
import { joinPath } from '@/lib/paths'
import { refreshTree } from '@/features/notes/actions'

export function registerCoreCommands() {

  commands.register({
    id: 'view.graph.open',
    title: 'Open graph',
    category: 'View',
    keywords: ['graph'],
    run: () => useTabStore.getState().openView('graph', 'Graph'),
  })
  commands.register({
    id: 'view.insights.open',
    title: 'Open insights',
    category: 'View',
    keywords: ['insights', 'health', 'orphans', 'duplicates'],
    run: () => useTabStore.getState().openView('insights', 'Insights'),
  })
  commands.register({
    id: 'view.plugins.open',
    title: 'Open plugins',
    category: 'View',
    keywords: ['plugins', 'extensions'],
    run: () => useTabStore.getState().openView('plugins', 'Plugins'),
  })
  commands.register({
    id: 'view.canvas.open',
    title: 'Open canvas',
    category: 'View',
    keywords: ['canvas'],
    run: () => useTabStore.getState().openView('canvas', 'Canvas'),
  })
  commands.register({
    id: 'view.databases.open',
    title: 'Open databases',
    category: 'View',
    keywords: ['database', 'table', 'properties'],
    run: () => useTabStore.getState().openView('databases', 'Databases'),
  })
  commands.register({
    id: 'view.calendar.open',
    title: 'Open calendar',
    category: 'View',
    keywords: ['calendar', 'daily', 'agenda'],
    run: () => useTabStore.getState().openView('calendar', 'Calendar'),
  })
  commands.register({
    id: 'view.search.open',
    title: 'Search workspace',
    category: 'View',
    keywords: ['search'],
    run: () => {
      useTabStore.getState().openView('search', 'Search')
    },
  })
  commands.register({
    id: 'view.settings.open',
    title: 'Open settings',
    category: 'View',
    keywords: ['settings'],
    run: () => useTabStore.getState().openView('settings', 'Settings'),
  })
  commands.register({
    id: 'view.tasks.open',
    title: 'Open tasks',
    category: 'View',
    keywords: ['tasks', 'todo', 'checkbox'],
    run: () => useTabStore.getState().openView('tasks', 'Tasks'),
  })
  commands.register({
    id: 'view.projects.open',
    title: 'Open projects',
    category: 'View',
    keywords: ['projects', 'dashboard'],
    run: () => useTabStore.getState().openView('projects', 'Projects'),
  })
  commands.register({
    id: 'view.attachments.open',
    title: 'Open attachments',
    category: 'View',
    keywords: ['attachments', 'files', 'upload', 'images'],
    run: () => useTabStore.getState().openView('attachments', 'Attachments'),
  })
  commands.register({
    id: 'view.templates.open',
    title: 'Open templates',
    category: 'View',
    keywords: ['templates', 'daily', 'project', 'research'],
    run: () => useTabStore.getState().openView('templates', 'Templates'),
  })
  commands.register({
    id: 'view.split.toggle',
    title: 'Toggle split pane',
    category: 'View',
    keywords: ['split', 'pane', 'side by side'],
    run: () => {
      const ts = useTabStore.getState()
      if (ts.splitTabId) {
        ts.setSplit(null)
        return
      }
      const other = [...ts.tabs]
        .reverse()
        .find((t) => t.id !== ts.activeTabId)
      if (other) ts.setSplit(other.id)
    },
  })
  commands.register({
    id: 'workspace.focus.toggle',
    title: 'Toggle focus mode',
    category: 'Workspace',
    keywords: ['focus', 'distraction', 'zen'],
    run: () => useWorkspaceStore.getState().toggleFocusMode(),
  })
  commands.register({
    id: 'layout.preset.default',
    title: 'Layout: Default',
    category: 'Layout',
    keywords: ['layout', 'preset', 'default'],
    run: () => applyLayoutPreset('default'),
  })
  commands.register({
    id: 'layout.preset.writing',
    title: 'Layout: Writing (focus)',
    category: 'Layout',
    keywords: ['layout', 'preset', 'writing', 'focus'],
    run: () => applyLayoutPreset('writing'),
  })
  commands.register({
    id: 'layout.preset.research',
    title: 'Layout: Research (split + search)',
    category: 'Layout',
    keywords: ['layout', 'preset', 'research', 'split'],
    run: () => applyLayoutPreset('research'),
  })
  commands.register({
    id: 'command.palette.open',
    title: 'Toggle command palette',
    category: 'System',
    keywords: ['palette', 'commands', 'cmd'],
    run: () => {
      const s = useCommandPaletteStore.getState()
      if (s.isOpen) s.close()
      else s.open()
    },
  })
  commands.register({
    id: 'workspace.sidebar.toggle',
    title: 'Toggle sidebar',
    category: 'Workspace',
    keywords: ['sidebar'],
    run: () => useWorkspaceStore.getState().toggleSidebar(),
  })
  commands.register({
    id: 'workspace.switch',
    title: 'Switch workspace',
    category: 'Workspace',
    keywords: ['workspace', 'switch', 'open'],
    run: () => useWorkspaceStore.getState().setWelcomeVisible(true),
  })
  commands.register({
    id: 'workspace.inspector.toggle',
    title: 'Toggle inspector',
    category: 'Workspace',
    keywords: ['inspector'],
    run: () => useWorkspaceStore.getState().toggleInspector(),
  })
  commands.register({
    id: 'note.create',
    title: 'Create note',
    category: 'Note',
    keywords: ['new', 'note', 'create'],
    run: () => void createNoteInInbox(),
  })
  commands.register({
    id: 'task.create',
    title: 'Create task',
    category: 'Task',
    keywords: ['new', 'task', 'create'],
    run: () => {
      void (async () => {
        const ws = useWorkspaceStore.getState().workspace
        if (!ws) return
        const inbox = await joinPath(ws.path, '00-Inbox')
        const path = await noteApi.create(inbox, 'Untitled Task')
        await noteApi.write(path, '- [ ] \n')
        await refreshTree()
        useTabStore.getState().openNote(path, 'Untitled Task')
      })()
    },
  })
  commands.register({
    id: 'app.update.check',
    title: 'Check for updates',
    category: 'System',
    keywords: ['update', 'upgrade', 'version', 'restart'],
    run: async () => {
      const result = await checkForUpdates()
      if (result.status !== 'installed') {
        await showInfo('Software Update', result.message)
      }
    },
  })
  commands.register({
    id: 'system.shortcuts.show',
    title: 'Show keyboard shortcuts',
    category: 'System',
    keywords: ['shortcuts', 'keys', 'hotkeys', 'bindings'],
    run: () => useShortcutsStore.getState().toggle(),
  })
}