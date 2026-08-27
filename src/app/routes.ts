export type ViewId =
  | 'inbox'
  | 'notes'
  | 'projects'
  | 'tasks'
  | 'graph'
  | 'insights'
  | 'canvas'
  | 'calendar'
  | 'databases'
  | 'attachments'
  | 'templates'
  | 'plugins'
  | 'files'
  | 'tags'
  | 'search'
  | 'settings'

export interface Route {
  id: ViewId
  label: string
}

export const ROUTES: Route[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'notes', label: 'Notes' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'graph', label: 'Graph' },
  { id: 'insights', label: 'Insights' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'databases', label: 'Databases' },
  { id: 'attachments', label: 'Attachments' },
  { id: 'templates', label: 'Templates' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'files', label: 'Files' },
  { id: 'tags', label: 'Tags' },
  { id: 'search', label: 'Search' },
  { id: 'settings', label: 'Settings' },
]