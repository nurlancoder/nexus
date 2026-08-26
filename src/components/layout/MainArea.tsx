import { useRef } from 'react'
import { useTabStore, type Tab } from '@/stores/tabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { ROUTES } from '@/app/routes'
import { TabBar } from './TabBar'
import { EmptyState } from './EmptyState'
import { ErrorBoundary } from './ErrorBoundary'
import { NoteView } from '@/features/notes/NoteView'
import { SearchView } from '@/components/search/SearchView'
import { GraphView } from '@/components/graph/GraphView'
import { InsightsView } from '@/components/insights/InsightsView'
import { CanvasView } from '@/components/canvas/CanvasView'
import { CanvasManager } from '@/components/canvas/CanvasManager'
import { DatabaseView } from '@/components/database/DatabaseView'
import { TasksView } from '@/components/tasks/TasksView'
import { ProjectsView } from '@/components/projects/ProjectsView'
import { CalendarView } from '@/components/calendar/CalendarView'
import { AttachmentsView } from '@/components/attachments/AttachmentsView'
import { TemplatesView } from '@/components/templates/TemplatesView'
import { PluginsView } from '@/components/plugins/PluginsView'

function PaneContent({ tab }: { tab: Tab }) {
  const route = tab.viewId ? ROUTES.find((r) => r.id === tab.viewId) : undefined

  return (
    <>
      {tab.kind === 'note' && tab.notePath ? (
        <NoteView key={tab.notePath} path={tab.notePath} />
      ) : tab.kind === 'canvas' && tab.canvasPath ? (
        <CanvasView key={tab.canvasPath} path={tab.canvasPath} />
      ) : tab.kind === 'view' && tab.viewId === 'search' ? (
        <SearchView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'graph' ? (
        <GraphView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'insights' ? (
        <InsightsView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'canvas' ? (
        <CanvasManager key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'databases' ? (
        <DatabaseView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'tasks' ? (
        <TasksView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'projects' ? (
        <ProjectsView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'calendar' ? (
        <CalendarView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'attachments' ? (
        <AttachmentsView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'templates' ? (
        <TemplatesView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'plugins' ? (
        <PluginsView key={tab.id} />
      ) : (
        <EmptyState key={tab.id} label={route?.label ?? tab.title} />
      )}
    </>
  )
}

function SplitDivider() {
  const dragging = useRef(false)

  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault()
        dragging.current = true
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        const onMove = (ev: MouseEvent) => {
          if (!dragging.current) return
          useTabStore.getState().setSplitRatio(ev.clientX / window.innerWidth)
        }
        const onUp = () => {
          dragging.current = false
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
      className="group relative z-10 w-px shrink-0 cursor-col-resize bg-transparent"
    >
      <div className="absolute inset-y-0 -left-1 w-2 transition-colors group-hover:bg-blue-400" />
    </div>
  )
}

export function MainArea() {
  const { tabs, activeTabId, splitTabId, splitRatio } = useTabStore()
  const focusMode = useWorkspaceStore((s) => s.focusMode)
  const theme = useWorkspaceStore((s) => s.theme)
  const isDark = theme === 'dark'

  const activeTab = tabs.find((t) => t.id === activeTabId)
  const splitTab =
    splitTabId && splitTabId !== activeTabId
      ? tabs.find((t) => t.id === splitTabId)
      : undefined
  const showSplit = Boolean(splitTab)

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {!focusMode && <TabBar />}
      <div className="nexus-fade-in flex min-h-0 flex-1 overflow-hidden">
        <div
          className="flex min-w-0 flex-col overflow-hidden"
          style={{ width: showSplit ? `${splitRatio * 100}%` : '100%' }}
        >
          {activeTab ? (
            <ErrorBoundary key={activeTab.id} label={activeTab.title}>
              <PaneContent tab={activeTab} />
            </ErrorBoundary>
          ) : (
            <div className="flex h-full items-center justify-center">
              <button
                onClick={() => useTabStore.getState().openView('inbox', 'Inbox')}
                className={`rounded-md px-4 py-2 text-[13px] font-medium ${
                  isDark
                    ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                    : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300'
                }`}
              >
                Open Inbox
              </button>
            </div>
          )}
        </div>

        {showSplit && splitTab && (
          <>
            <SplitDivider />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <div
                className={`flex h-8 shrink-0 items-center gap-1.5 border-b px-2 ${
                  isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-blue-500">
                  {splitTab.title}
                </span>
                <button
                  onClick={() => useTabStore.getState().swapPanes()}
                  title="Swap panes"
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    isDark
                      ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                      : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700'
                  }`}
                >
                  ⇄
                </button>
                <button
                  onClick={() => useTabStore.getState().setSplit(null)}
                  title="Close split pane"
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    isDark
                      ? 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-200 hover:text-zinc-800'
                  }`}
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ErrorBoundary key={splitTab.id} label={splitTab.title}>
                  <PaneContent tab={splitTab} />
                </ErrorBoundary>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
