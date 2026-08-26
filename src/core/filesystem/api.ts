import { invoke } from '@/lib/tauri'
import type { Workspace, FileNode } from '@/types'

export const workspaceApi = {
  create: (name: string, parentPath: string) =>
    invoke<Workspace>('workspace_create', { name, parentPath }),
  open: (path: string) => invoke<Workspace>('workspace_open', { path }),
  recent: () => invoke<Workspace[]>('workspace_recent'),
  tree: (path: string) => invoke<FileNode[]>('workspace_tree', { path }),
}

export const noteApi = {
  read: (path: string) => invoke<string>('note_read', { path }),
  write: (path: string, content: string) =>
    invoke<null>('note_write', { path, content }),
  create: (parent: string, title: string) =>
    invoke<string>('note_create', { parent, title }),
  rename: (path: string, newName: string) =>
    invoke<string>('note_rename', { path, newName }),
  remove: (path: string) => invoke<null>('note_delete', { path }),
  move: (path: string, targetDir: string) =>
    invoke<string>('note_move', { path, targetDir }),
  duplicate: (path: string) => invoke<string>('note_duplicate', { path }),
}

export interface SearchResult {
  path: string
  title: string
  snippet: string
}

export const searchApi = {
  query: (workspacePath: string, query: string, limit?: number) =>
    invoke<SearchResult[]>('search_query', { workspacePath, query, limit }),
  reindex: (workspacePath: string) =>
    invoke<number>('search_reindex', { workspacePath }),
}

export interface LinkHit {
  path: string
  title: string
  snippet: string
  matched: string
  viaLink: boolean
}

export interface LinkResolution {
  backlinks: LinkHit[]
  mentions: LinkHit[]
}

export interface GraphNode {
  path: string
  title: string
  tags: string[]
  links: string[]
}

export const linkingApi = {
  resolve: (workspacePath: string, targetPath: string) =>
    invoke<LinkResolution>('linking_resolve', { workspacePath, targetPath }),
  graph: (workspacePath: string) =>
    invoke<GraphNode[]>('linking_graph', { workspacePath }),
}

export const canvasApi = {
  create: (parent: string, title: string) =>
    invoke<string>('canvas_create', { parent, title }),
  save: (path: string, content: string) =>
    invoke<null>('canvas_save', { path, content }),
  load: (path: string) => invoke<string>('canvas_load', { path }),
}

export interface DatabaseDefinition {
  sourceFolders: string[]
  filterKey?: string | null
  filterValue?: string | null
  columns: string[]
  sortKey?: string | null
  sortDir?: 'asc' | 'desc' | null
}

export interface DatabaseMeta {
  id: number
  name: string
  definition: DatabaseDefinition
}

export interface DatabaseRow {
  path: string
  title: string
  properties: Record<string, string>
}

export const databaseApi = {
  list: (workspacePath: string) =>
    invoke<DatabaseMeta[]>('database_list', { workspacePath }),
  save: (workspacePath: string, name: string, definition: DatabaseDefinition) =>
    invoke<null>('database_save', { workspacePath, name, definition }),
  delete: (workspacePath: string, name: string) =>
    invoke<null>('database_delete', { workspacePath, name }),
  rows: (workspacePath: string, sourceFolders: string[]) =>
    invoke<DatabaseRow[]>('database_rows', { workspacePath, sourceFolders }),
}

export interface TaskItem {
  path: string
  noteTitle: string
  folder: string
  line: number
  text: string
  done: boolean
  due?: string | null
  priority?: string | null
  tags: string[]
}

export const taskApi = {
  scan: (workspacePath: string) =>
    invoke<TaskItem[]>('task_scan', { workspacePath }),
  toggle: (path: string, line: number, done: boolean) =>
    invoke<null>('task_toggle', { path, line, done }),
}

export interface ProjectSummary {
  name: string
  path: string
  noteCount: number
  openTasks: number
  doneTasks: number
  updatedAt: string
}

export interface ProjectNote {
  path: string
  title: string
  updatedAt: string
}

export interface ProjectResource {
  path: string
  name: string
  size: number
}

export interface ProjectDetail {
  name: string
  path: string
  notes: ProjectNote[]
  tasks: TaskItem[]
  resources: ProjectResource[]
}

export const projectApi = {
  list: (workspacePath: string) =>
    invoke<ProjectSummary[]>('project_list', { workspacePath }),
  detail: (workspacePath: string, name: string) =>
    invoke<ProjectDetail>('project_detail_cmd', { workspacePath, name }),
}

export interface CalendarEvent {
  date: string
  kind: 'daily' | 'note' | 'task'
  path: string
  title: string
}

export interface DailyNoteInfo {
  path: string
  created: boolean
}

export const calendarApi = {
  events: (workspacePath: string, year: number, month: number) =>
    invoke<CalendarEvent[]>('calendar_events', { workspacePath, year, month }),
  openDaily: (workspacePath: string, date: string) =>
    invoke<DailyNoteInfo>('daily_note_open', { workspacePath, date }),
}

export interface AttachmentInfo {
  path: string
  name: string
  size: number
  kind: 'image' | 'pdf' | 'other' | string
}

export const attachmentApi = {
  save: (workspacePath: string, name: string, dataBase64: string) =>
    invoke<AttachmentInfo>('attachment_save', { workspacePath, name, dataBase64 }),
  list: (workspacePath: string) =>
    invoke<AttachmentInfo[]>('attachment_list', { workspacePath }),
  read: (path: string) => invoke<string>('attachment_read', { path }),
  delete: (path: string) => invoke<null>('attachment_delete', { path }),
}

export interface TemplateInfo {
  name: string
  path: string
}

export const templateApi = {
  list: (workspacePath: string) =>
    invoke<TemplateInfo[]>('template_list', { workspacePath }),
  read: (path: string) => invoke<string>('template_read', { path }),
  createNote: (
    workspacePath: string,
    templateName: string,
    title: string,
    parentFolder?: string | null,
  ) =>
    invoke<string>('template_create_note', {
      workspacePath,
      templateName,
      title,
      parentFolder: parentFolder ?? null,
    }),
}
export interface VersionInfo {
  id: number
  createdAt: string
  size: number
}

export const historyApi = {
  list: (path: string) => invoke<VersionInfo[]>('history_list', { path }),
  get: (id: number) => invoke<string>('history_get', { id }),
  restore: (path: string, id: number) =>
    invoke<null>('history_restore', { path, id }),
  prune: (path: string, keep?: number) =>
    invoke<number>('history_prune', { path, keep: keep ?? null }),
}

export interface OrphanInfo {
  path: string
  title: string
}

export interface BrokenLinkInfo {
  sourcePath: string
  sourceTitle: string
  target: string
}

export interface DuplicateGroup {
  paths: string[]
}

export interface NoteHealth {
  path: string
  title: string
  score: number
  words: number
  linksOut: number
  linksIn: number
}

export interface InsightsTotals {
  notes: number
  orphans: number
  brokenLinks: number
  duplicateGroups: number
  avgHealth: number
}

export interface InsightsReport {
  orphans: OrphanInfo[]
  brokenLinks: BrokenLinkInfo[]
  duplicates: DuplicateGroup[]
  health: NoteHealth[]
  totals: InsightsTotals
}

export const insightsApi = {
  report: (workspacePath: string) =>
    invoke<InsightsReport>('insights_report', { workspacePath }),
}

export interface PluginInfo {
  name: string
  path: string
}

export const pluginApi = {
  list: (workspacePath: string) =>
    invoke<PluginInfo[]>('plugin_list', { workspacePath }),
  read: (workspacePath: string, name: string) =>
    invoke<string>('plugin_read', { workspacePath, name }),
}
