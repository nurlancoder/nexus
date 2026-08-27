import { Suspense, lazy, useRef } from 'react'
import { useTabStore, type Tab } from '@/stores/tabStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { ROUTES } from '@/app/routes'
import { TabBar } from './TabBar'
import { EmptyState } from './EmptyState'
import { ErrorBoundary } from './ErrorBoundary'

const NoteView = lazy(() => import('@/features/notes/NoteView').then(m => ({ default: m.NoteView })))

const GraphView = lazy(() => import('@/components/graph/GraphView').then(m => ({ default: m.GraphView })))
const InsightsView = lazy(() => import('@/components/insights/InsightsView').then(m => ({ default: m.InsightsView })))
const CanvasView = lazy(() => import('@/components/canvas/CanvasView').then(m => ({ default: m.CanvasView })))
const CanvasManager = lazy(() => import('@/components/canvas/CanvasManager').then(m => ({ default: m.CanvasManager })))
const DatabaseView = lazy(() => import('@/components/database/DatabaseView').then(m => ({ default: m.DatabaseView })))
const AttachmentsView = lazy(() => import('@/components/attachments/AttachmentsView').then(m => ({ default: m.AttachmentsView })))
const PluginsView = lazy(() => import('@/components/plugins/PluginsView').then(m => ({ default: m.PluginsView })))
const SearchView = lazy(() => import('@/components/search/SearchView').then(m => ({ default: m.SearchView })))
const TagsView = lazy(() => import('@/features/tags/TagsView').then(m => ({ default: m.TagsView })))
const TasksView = lazy(() => import('@/components/tasks/TasksView').then(m => ({ default: m.TasksView })))
const ProjectsView = lazy(() => import('@/components/projects/ProjectsView').then(m => ({ default: m.ProjectsView })))
const CalendarView = lazy(() => import('@/components/calendar/CalendarView').then(m => ({ default: m.CalendarView })))
const TemplatesView = lazy(() => import('@/components/templates/TemplatesView').then(m => ({ default: m.TemplatesView })))
const SettingsView = lazy(() => import('@/components/settings/SettingsView').then(m => ({ default: m.SettingsView })))

function LoadingIndicator() {
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'
  return (
    <div className="flex h-full items-center justify-center">
      <div className={`h-8 w-8 animate-spin rounded-full border-2 ${
        isDark ? 'border-zinc-600 border-t-blue-400' : 'border-zinc-300 border-t-blue-500'
      }`} />
    </div>
  )
}

function PaneContent({ tab }: { tab: Tab }) {
  const route = tab.viewId ? ROUTES.find((r) => r.id === tab.viewId) : undefined

  return (
    <Suspense fallback={<LoadingIndicator />}>
      {tab.kind === 'note' && tab.notePath ? (
        <NoteView key={tab.notePath} path={tab.notePath} />
      ) : tab.kind === 'canvas' && tab.canvasPath ? (
        <CanvasView key={tab.canvasPath} path={tab.canvasPath} />
      ) : tab.kind === 'view' && tab.viewId === 'search' ? (
        <SearchView key={tab.id} />
      ) : tab.kind === 'view' && tab.viewId === 'tags' ? (
        <TagsView key={tab.id} />
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
      ) : tab.kind === 'view' && tab.viewId === 'settings' ? (
        <SettingsView key={tab.id} />
      ) : (
        <EmptyState key={tab.id} label={route?.label ?? tab.title} />
      )}
    </Suspense>
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
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-[2px]">
          <span className="block h-[2px] w-[2px] rounded-full bg-zinc-500" />
          <span className="block h-[2px] w-[2px] rounded-full bg-zinc-500" />
          <span className="block h-[2px] w-[2px] rounded-full bg-zinc-500" />
          <span className="block h-[2px] w-[2px] rounded-full bg-zinc-500" />
          <span className="block h-[2px] w-[2px] rounded-full bg-zinc-500" />
          <span className="block h-[2px] w-[2px] rounded-full bg-zinc-500" />
        </div>
      </div>
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
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="text-5xl opacity-20">◈</div>
              <p className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                No open tabs
              </p>
              <button
                onClick={() => useTabStore.getState().openView('inbox', 'Inbox')}
                className="rounded-md bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-500"
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
                  aria-label="Swap panes"
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
                  aria-label="Close split pane"
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
