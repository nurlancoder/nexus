import type { Workspace, FileNode } from '@/types'

const KEY_PREFIX = 'nexus.mock.'

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

interface MockNote {
  path: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface MockSource {
  kind: 'note' | 'canvas'
  path: string
  content: string
}

interface MockPlugin {
  name: string
  source: string
}

interface MockDatabase {
  name: string
  definition: DatabaseDefinitionLike
}

interface MockAttachment {
  path: string
  name: string
  size: number
  data: string
}

interface MockTemplate {
  name: string
  source: string
}

interface MockStore {
  notes: MockNote[]
  canvases: MockSource[]
  plugins: MockPlugin[]
  databases: MockDatabase[]
  attachments: MockAttachment[]
  templates: MockTemplate[]
  history: Record<string, { id: number; createdAt: string; content: string }[]>
}

interface DatabaseDefinitionLike {
  sourceFolders: string[]
  filterKey?: string | null
  filterValue?: string | null
  columns: string[]
}

const emptyStore = (): MockStore => ({
  notes: [],
  canvases: [],
  plugins: [],
  databases: [],
  attachments: [],
  templates: [],
  history: {},
})

function loadStore(workspacePath: string): MockStore {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + workspacePath)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<MockStore>
    return { ...emptyStore(), ...parsed }
  } catch {
    return emptyStore()
  }
}

function saveStore(workspacePath: string, store: MockStore): void {
  try {
    localStorage.setItem(KEY_PREFIX + workspacePath, JSON.stringify(store))
  } catch {
    // storage full / unavailable — non-fatal
  }
}

// ---------------------------------------------------------------------------
// Demo workspace seeding
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function seedDemoStore(ws: string, store: MockStore): void {
  const now = new Date().toISOString()
  const today = isoDate(new Date())
  const pushNote = (path: string, title: string, content: string) => {
    store.notes.push({ path, title, content, createdAt: now, updatedAt: now })
  }

  pushNote(
    `${ws}/00-Inbox/Quick capture.md`,
    'Quick capture',
    [
      '# Quick capture',
      '',
      'A scratch space for unorganized thoughts. File them later or leave them here.',
      '',
      '- [ ] Review the weekly plan @due:2026-08-30 #inbox',
      '- [ ] Reply to project email',
      '',
    ].join('\n'),
  )

  pushNote(
    `${ws}/Projects/Nexus Roadmap.md`,
    'Nexus Roadmap',
    [
      '---',
      'tags: [project, roadmap]',
      '---',
      '# Nexus Roadmap',
      '',
      'Product plan for the [[Nexus Roadmap|workspace]]. See [[Design System]] for visual tokens.',
      '',
      '## Current quarter',
      '- [x] Local-first storage @done',
      '- [ ] Plugin marketplace @due:2026-09-01 @priority:high #project',
      '- [ ] Saved searches @due:2026-08-28 #project',
      '- [ ] Graph performance #project',
      '',
    ].join('\n'),
  )

  pushNote(
    `${ws}/Knowledge/Design System.md`,
    'Design System',
    [
      '---',
      'tags: [design, ui]',
      '---',
      '# Design System',
      '',
      'Shared visual language for [[Nexus Roadmap]].',
      '',
      '## Tokens',
      '- Primary: indigo-600',
      '- Accent: emerald-500',
      '- Nav: [[Nexus Roadmap]]',
      '',
    ].join('\n'),
  )

  pushNote(
    `${ws}/Knowledge/Zettelkasten method.md`,
    'Zettelkasten method',
    [
      '---',
      'tags: [notes, method]',
      '---',
      '# Zettelkasten method',
      '',
      'A note-taking system of [[Design System|atomic notes]] linked together.',
      'Every note should stand alone and connect to related ideas. Try it with #notes.',
      '',
    ].join('\n'),
  )

  pushNote(
    `${ws}/Daily/${today}.md`,
    today,
    [
      `# ${today}`,
      '',
      'Daily entry. Links: [[Nexus Roadmap]] and #daily',
      '',
      '- [ ] Morning review @due:${today} #daily',
      '',
    ].join('\n'),
  )

  if (!store.canvases.some((c) => c.kind === 'canvas')) {
    store.canvases.push({ kind: 'canvas', path: `${ws}/Canvases/Mindmap.canvas`, content: '' })
  }
  if (store.templates.length === 0) {
    store.templates.push({
      name: 'Book Review',
      source: [
        '# ${title}',
        '',
        '## Summary',
        '',
        '## Key takeaways',
        '- ',
        '',
        '## Notes',
        '',
      ].join('\n'),
    })
  }
  if (store.databases.length === 0) {
    store.databases.push({
      name: 'Projects',
      definition: {
        sourceFolders: ['Projects'],
        filterKey: null,
        filterValue: null,
        columns: ['title', 'created'],
      },
    })
  }
  if (store.attachments.length === 0) {
    store.attachments.push({
      path: `${ws}/attachments/hello.txt`,
      name: 'hello.txt',
      size: 5,
      data: btoa('hello'),
    })
  }
}

// ---------------------------------------------------------------------------
// Note content helpers
// ---------------------------------------------------------------------------

function titleOf(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m)
  if (m) return m[1].trim()
  return fallback
}

function bodyAfterFrontmatter(content: string): string {
  if (!content.startsWith('---')) return content
  const end = content.indexOf('\n---', 3)
  if (end === -1) return content
  return content.slice(end + 4)
}

function frontmatterList(content: string, key: string): string[] {
  if (!content.startsWith('---')) return []
  const end = content.indexOf('\n---', 3)
  if (end === -1) return []
  const fm = content.slice(3, end)
  const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'mi')
  const m = fm.match(re)
  if (!m) return []
  return m[1]
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function tagsOf(content: string): string[] {
  const tags: string[] = []
  const bodySet = new Set(bodyAfterFrontmatter(content).match(/#[A-Za-z0-9_\-\u00C0-\u024F]+/g) || [])
  for (const t of bodySet) tags.push(t.slice(1))
  for (const t of frontmatterList(content, 'tags')) {
    const clean = t.startsWith('#') ? t.slice(1) : t
    tags.push(clean)
  }
  return [...new Set(tags)]
}

function linksOf(content: string): string[] {
  const out: string[] = []
  const re = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    const target = m[1].trim().replace(/\.(md|markdown)$/i, '')
    if (target && !out.includes(target)) out.push(target)
  }
  return out
}

function tasksOf(content: string): { text: string; done: boolean; line: number; due?: string | null; priority?: string | null; tags: string[] }[] {
  const out: { text: string; done: boolean; line: number; due?: string | null; priority?: string | null; tags: string[] }[] = []
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/)
    if (!m) return
    const text = m[2].trim()
    const tags = (text.match(/#[A-Za-z0-9_\-\u00C0-\u024F]+/g) || []).map((t) => t.slice(1))
    const due = text.match(/@due:\s*(\S+)/)?.[1] ?? null
    const priority = text.match(/@priority:\s*(\S+)/)?.[1] ?? null
    out.push({ text, done: m[1].toLowerCase() === 'x', line: i + 1, due, priority, tags })
  })
  return out
}

function sanitizeNoteName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '').trim()
}

function extOf(path: string): string {
  const i = path.lastIndexOf('.')
  return i === -1 ? '' : path.slice(i + 1).toLowerCase()
}

// ---------------------------------------------------------------------------
// Shared data access
// ---------------------------------------------------------------------------

function workspacePathOf(path: string): string {
  return path.split('/').slice(0, -1).join('/')
}

// ---------------------------------------------------------------------------
// The browser backend — answers every Tauri command id
// ---------------------------------------------------------------------------

export function browserInvoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const send = <R>(value: R): Promise<T> => Promise.resolve(value as unknown as T)

  switch (command) {
    case 'workspace_create': {
      const name = String(args.name)
      const parentPath = String(args.parentPath)
      const path = `${parentPath}/${name}`
      const ws: Workspace = {
        id: Date.now(),
        name,
        path,
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      }
      const store = loadStore(path)
      if (store.notes.length === 0) seedDemoStore(path, store)
      saveStore(path, store)
      return send(ws)
    }

    case 'workspace_open': {
      const path = String(args.path)
      const name = path.split('/').filter(Boolean).pop() ?? 'Workspace'
      const ws: Workspace = {
        id: Date.now(),
        name,
        path,
        createdAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
      }
      const store = loadStore(path)
      if (store.notes.length === 0) seedDemoStore(path, store)
      saveStore(path, store)
      return send(ws)
    }

    case 'workspace_recent': {
      return send([])
    }

    case 'workspace_tree': {
      const path = String(args.path)
      const store = loadStore(path)
      const root: FileNode = { name: '', path: '', isDir: true, children: [] }
      const dirIndex = new Map<string, FileNode>()
      dirIndex.set('', root)
      const ensureDir = (dirPath: string): FileNode => {
        let node = dirIndex.get(dirPath)
        if (node) return node
        const parentPath = dirPath.slice(0, dirPath.lastIndexOf('/'))
        const parent = ensureDir(parentPath)
        const name = dirPath.slice(dirPath.lastIndexOf('/') + 1)
        node = { name, path: dirPath, isDir: true, children: [] }
        parent.children.push(node)
        dirIndex.set(dirPath, node)
        return node
      }
      const allPaths = new Set<string>()
      for (const n of store.notes) allPaths.add(n.path)
      for (const c of store.canvases) allPaths.add(c.path)
      for (const a of store.attachments) allPaths.add(a.path)
      const sorted = [...allPaths].sort()
      for (const full of sorted) {
        const rel = full.slice(path.length).replace(/^\//, '')
        const segs = rel.split('/')
        let dir = ''
        for (let i = 0; i < segs.length - 1; i++) {
          dir = dir ? `${dir}/${segs[i]}` : segs[i]
          ensureDir(dir)
        }
        const parent = ensureDir(segs.length > 1 ? dir : '')
        parent.children.push({
          name: segs[segs.length - 1],
          path: full,
          isDir: false,
          children: [],
        })
      }
      return send(root.children)
    }

    case 'note_read': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const note = store.notes.find((n) => n.path === path)
      if (!note) return Promise.reject(new Error('Note not found'))
      return send(note.content as T)
    }

    case 'note_write': {
      const path = String(args.path)
      const content = String(args.content)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const note = store.notes.find((n) => n.path === path)
      const now = new Date().toISOString()
      if (note) {
        note.content = content
        note.title = titleOf(content, note.title)
        note.updatedAt = now
      } else {
        store.notes.push({
          path,
          title: titleOf(content, path.split('/').pop()!.replace(/\.[^.]+$/, '')),
          content,
          createdAt: now,
          updatedAt: now,
        })
      }
      const history = store.history[path] || (store.history[path] = [])
      const nextId = (store.history[path]!.reduce((max, v) => Math.max(max, v.id), 0) || 0) + 1
      history.unshift({ id: nextId, createdAt: now, content })
      if (history.length > 50) history.length = 50
      saveStore(ws, store)
      return send(null)
    }

    case 'note_create': {
      const parent = String(args.parent)
      const title = sanitizeNoteName(String(args.title)) || 'Untitled'
      const path = `${parent.replace(/\/$/, '')}/${title}.md`
      const content = `# ${title}\n\n`
      return browserInvoke('note_write', { path, content })
    }

    case 'note_rename': {
      const path = String(args.path)
      const newName = sanitizeNoteName(String(args.newName))
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const i = store.notes.findIndex((n) => n.path === path)
      if (i === -1) return Promise.reject(new Error('Note not found'))
      const dir = path.slice(0, path.lastIndexOf('/'))
      const newPath = `${dir}/${newName}${extOf(path) ? '.' + extOf(path) : '.md'}`
      store.notes[i].path = newPath
      store.notes[i].title = titleOf(store.notes[i].content, newName)
      saveStore(ws, store)
      return send(newPath)
    }

    case 'note_duplicate': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const note = store.notes.find((n) => n.path === path)
      if (!note) return Promise.reject(new Error('Note not found'))
      const newPath = `${path.replace(/\.\w+$/, '')} copy.md`
      store.notes.push({
        ...note,
        path: newPath,
        title: `${note.title} copy`,
        content: note.content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      saveStore(ws, store)
      return send(newPath)
    }

    case 'note_delete': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      store.notes = store.notes.filter((n) => n.path !== path)
      delete store.history[path]
      saveStore(ws, store)
      return send(null)
    }

    case 'note_move': {
      const path = String(args.path)
      const targetDir = String(args.targetDir).replace(/\/$/, '')
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const i = store.notes.findIndex((n) => n.path === path)
      if (i === -1) return Promise.reject(new Error('Note not found'))
      const name = path.split('/').pop()!
      const newPath = `${targetDir}/${name}`
      store.notes[i].path = newPath
      saveStore(ws, store)
      return send(newPath)
    }

    case 'search_query': {
      const ws = String(args.workspacePath)
      const q = String(args.query).toLowerCase().trim()
      const limit = args.limit ? Number(args.limit) : 100
      const store = loadStore(ws)
      const results: { path: string; title: string; snippet: string }[] = []
      for (const n of store.notes) {
        if (q.length < 2) break
        const lower = n.content.toLowerCase()
        if (!lower.includes(q)) continue
        const idx = lower.indexOf(q)
        const snippet = n.content.slice(Math.max(0, idx - 40), idx + q.length + 60).replace(/\s*\n\s*/g, ' ')
        results.push({ path: n.path, title: n.title, snippet })
        if (results.length >= limit) break
      }
      return send(results as T)
    }

    case 'search_reindex': {
      return send(0)
    }

    case 'tags_list': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      const counts = new Map<string, number>()
      for (const n of store.notes) {
        for (const t of tagsOf(n.content)) counts.set(t, (counts.get(t) || 0) + 1)
      }
      const out = [...counts.entries()]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
      return send(out as T)
    }

    case 'tags_notes': {
      const ws = String(args.workspacePath)
      const tag = String(args.tag).toLowerCase()
      const store = loadStore(ws)
      const out: { path: string; title: string; snippet: string }[] = []
      for (const n of store.notes) {
        if (!tagsOf(n.content).some((t) => t.toLowerCase() === tag)) continue
        const body = n.content
        const idx = body.toLowerCase().indexOf('#' + tag.toLowerCase())
        const snippet = body.slice(Math.max(0, idx - 40), idx + tag.length + 60).replace(/\s*\n\s*/g, ' ')
        out.push({ path: n.path, title: n.title, snippet })
      }
      out.sort((a, b) => a.title.localeCompare(b.title))
      return send(out as T)
    }

    case 'linking_resolve': {
      const ws = String(args.workspacePath)
      const targetPath = String(args.targetPath)
      const store = loadStore(ws)
      const target = store.notes.find((n) => n.path === targetPath)
      const targetTitle = target ? target.title : targetPath.split('/').pop()!.replace(/\.[^.]+$/, '')
      const backlinks: { path: string; title: string; snippet: string; matched: string; viaLink: boolean }[] = []
      const mentions: { path: string; title: string; snippet: string; matched: string; viaLink: boolean }[] = []
      for (const n of store.notes) {
        if (n.path === targetPath) continue
        const titleLower = n.title.toLowerCase()
        const viaLink = Boolean(n.content.match(new RegExp(`\\[\\[\\s*${targetTitle}\\s*\\]\\]`, 'i')))
        const viaMention = !viaLink && n.content.toLowerCase().includes(titleLower)
        if (viaLink || viaMention) {
          const idx = n.content.toLowerCase().indexOf(titleLower)
          const snippet = n.content.slice(Math.max(0, idx - 40), idx + targetTitle.length + 60).replace(/\s*\n\s*/g, ' ')
          const hit = { path: n.path, title: n.title, snippet, matched: targetTitle, viaLink }
          if (viaLink) backlinks.push(hit)
          else mentions.push(hit)
        }
      }
      return send({ backlinks, mentions } as T)
    }

    case 'linking_graph': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      const nodes = store.notes.map((n) => ({
        path: n.path,
        title: n.title,
        tags: tagsOf(n.content),
        links: linksOf(n.content),
      }))
      return send(nodes as T)
    }

    case 'canvas_create': {
      const parent = String(args.parent).replace(/\/$/, '')
      const title = sanitizeNoteName(String(args.title)) || 'Canvas'
      const path = `${parent}/${title}.canvas`
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      if (!store.canvases.some((c) => c.path === path)) {
        store.canvases.push({ kind: 'canvas', path, content: '' })
      }
      saveStore(ws, store)
      return send(path)
    }

    case 'canvas_save': {
      const path = String(args.path)
      const content = String(args.content)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const i = store.canvases.findIndex((c) => c.path === path && c.kind === 'canvas')
      if (i === -1) store.canvases.push({ kind: 'canvas', path, content })
      else store.canvases[i].content = content
      saveStore(ws, store)
      return send(null)
    }

    case 'canvas_load': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const c = store.canvases.find((c) => c.path === path && c.kind === 'canvas')
      return send(c ? c.content : '')
    }

    case 'database_list': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      return send(store.databases.map((d, i) => ({ id: i + 1, name: d.name, definition: d.definition })) as T)
    }

    case 'database_save': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const definition = args.definition as unknown as DatabaseDefinitionLike
      const store = loadStore(ws)
      const i = store.databases.findIndex((d) => d.name === name)
      const def: DatabaseDefinitionLike = {
        sourceFolders: definition.sourceFolders || [],
        filterKey: definition.filterKey ?? null,
        filterValue: definition.filterValue ?? null,
        columns: definition.columns.length ? definition.columns : ['title', 'created'],
      }
      if (i === -1) store.databases.push({ name, definition: def })
      else store.databases[i].definition = def
      saveStore(ws, store)
      return send(null)
    }

    case 'database_delete': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const store = loadStore(ws)
      store.databases = store.databases.filter((d) => d.name !== name)
      saveStore(ws, store)
      return send(null)
    }

    case 'database_rows': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      const out = store.notes.map((n) => ({
        path: n.path,
        title: n.title,
        properties: { created: n.createdAt.slice(0, 10) },
      }))
      return send(out as T)
    }

    case 'task_scan': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      const out: { path: string; noteTitle: string; folder: string; line: number; text: string; done: boolean; due?: string | null; priority?: string | null; tags: string[] }[] = []
      for (const n of store.notes) {
        for (const t of tasksOf(n.content)) {
          out.push({
            path: n.path,
            noteTitle: n.title,
            folder: n.path.slice(ws.length).split('/').filter(Boolean).slice(0, -1).join('/'),
            line: t.line,
            text: t.text,
            done: t.done,
            due: t.due,
            priority: t.priority,
            tags: t.tags,
          })
        }
      }
      return send(out as T)
    }

    case 'task_toggle': {
      const path = String(args.path)
      const line = Number(args.line)
      const done = Boolean(args.done)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const note = store.notes.find((n) => n.path === path)
      if (note) {
        const lines = note.content.split('\n')
        if (lines[line - 1]) {
          lines[line - 1] = lines[line - 1].replace(/\[([ xX])\]/, done ? '[x]' : '[ ]')
          note.content = lines.join('\n')
          note.updatedAt = new Date().toISOString()
        }
      }
      saveStore(ws, store)
      return send(null)
    }

    case 'project_list': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      const folders = new Map<string, MockNote[]>()
      for (const n of store.notes) {
        const rel = n.path.slice(ws.length).replace(/^\//, '')
        const segs = rel.split('/')
        const folder = segs.slice(0, -1).join('/') || '(inbox)'
        if (!folders.has(folder)) folders.set(folder, [])
        folders.get(folder)!.push(n)
      }
      const out = [...folders.entries()].map(([name, notes]) => {
        const tasks = notes.flatMap((n) => tasksOf(n.content))
        return {
          name,
          path: `${ws}/${name === '(inbox)' ? '' : name}`,
          noteCount: notes.length,
          openTasks: tasks.filter((t) => !t.done).length,
          doneTasks: tasks.filter((t) => t.done).length,
          updatedAt: notes.reduce((max, n) => (n.updatedAt > max ? n.updatedAt : max), ''),
        }
      })
      out.sort((a, b) => a.name.localeCompare(b.name))
      return send(out as T)
    }

    case 'project_detail_cmd': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const store = loadStore(ws)
      const folder = name === '(inbox)' ? '' : name
      const notes = store.notes.filter((n) => {
        const rel = n.path.slice(ws.length).replace(/^\//, '')
        const relFolder = rel.split('/').slice(0, -1).join('/')
        return relFolder === folder
      })
      const tasks = notes.flatMap((n) =>
        tasksOf(n.content).map((t) => ({
          path: n.path,
          noteTitle: n.title,
          folder: folder,
          line: t.line,
          text: t.text,
          done: t.done,
          due: t.due,
          priority: t.priority,
          tags: t.tags,
        })),
      )
      return send({
        name,
        path: `${ws}/${folder}`,
        notes: notes.map((n) => ({ path: n.path, title: n.title, updatedAt: n.updatedAt })),
        tasks,
        resources: [],
      } as T)
    }

    case 'calendar_events': {
      const ws = String(args.workspacePath)
      const year = Number(args.year)
      const month = Number(args.month)
      const store = loadStore(ws)
      const pad = (n: number) => String(n).padStart(2, '0')
      const prefix = `${year}-${pad(month)}`
      const days = store.notes.filter((n) => n.path.includes(`/Daily/${prefix}`))
      const out = days.map((n) => ({
        date: n.path.split('/').pop()!.replace(/\.\w+$/, ''),
        kind: 'daily' as const,
        path: n.path,
        title: n.title,
      }))
      return send(out as T)
    }

    case 'daily_note_open': {
      const ws = String(args.workspacePath)
      const date = String(args.date)
      const path = `${ws}/Daily/${date}.md`
      const store = loadStore(ws)
      const exists = store.notes.some((n) => n.path === path)
      if (!exists) {
        store.notes.push({
          path,
          title: date,
          content: `# ${date}\n\n`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        saveStore(ws, store)
      }
      return send({ path, created: !exists })
    }

    case 'attachment_save': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const data = String(args.dataBase64)
      const path = `${ws}/attachments/${name}`
      const store = loadStore(ws)
      const existing = store.attachments.find((a) => a.name === name)
      if (existing) {
        existing.data = data
        existing.size = data.length
      } else {
        store.attachments.push({ path, name, size: data.length, data })
      }
      saveStore(ws, store)
      return send({ path, name, size: data.length, kind: extOf(name) } as T)
    }

    case 'attachment_list': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      return send(store.attachments.map((a) => ({ path: a.path, name: a.name, size: a.size, kind: extOf(a.name) })) as T)
    }

    case 'attachment_read': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const a = store.attachments.find((x) => x.path === path)
      if (!a) return Promise.reject(new Error('Attachment not found'))
      return send(a.data)
    }

    case 'attachment_delete': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      store.attachments = store.attachments.filter((a) => a.path !== path)
      saveStore(ws, store)
      return send(null)
    }

    case 'template_list': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      return send(store.templates.map((t) => ({ name: t.name, path: `${ws}/templates/${t.name}` })) as T)
    }

    case 'template_read': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const name = path.split('/').pop()!.replace(/\.\w+$/, '')
      const t = store.templates.find((x) => x.name === name)
      if (!t) return Promise.reject(new Error('Template not found'))
      return send(t.source)
    }

    case 'template_create_note': {
      const ws = String(args.workspacePath)
      const templateName = String(args.templateName)
      const title = sanitizeNoteName(String(args.title)) || 'Untitled'
      const parentFolder = args.parentFolder ? String(args.parentFolder) : null
      const store = loadStore(ws)
      const t = store.templates.find((x) => x.name === templateName)
      const source = t ? t.source : ''
      const dir = parentFolder ? `${ws}/${parentFolder.replace(/^\//, '').replace(/\/$/, '')}` : ws
      const path = `${dir}/${title}.md`
      let content = source.trim()
      if (content && !/^#/.test(content)) content = `# ${title}\n\n${content}`
      store.notes.push({
        path,
        title,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      saveStore(ws, store)
      return send(path)
    }

    case 'history_list': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const h = store.history[path] || []
      return send(h.map((v, i) => ({ id: v.id || i + 1, createdAt: v.createdAt, size: v.content.length })) as T)
    }

    case 'history_get': {
      const path = String(args.path)
      const id = Number(args.id)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const h = store.history[path] || []
      const v = h.find((x) => x.id === id)
      if (!v) return Promise.reject(new Error('Version not found'))
      return send(v.content)
    }

    case 'history_restore': {
      const path = String(args.path)
      const id = Number(args.id)
      const ws = workspacePathOf(path)
      const store = loadStore(ws)
      const h = store.history[path] || []
      const v = h.find((x) => x.id === id)
      if (!v) return Promise.reject(new Error('Version not found'))
      const note = store.notes.find((n) => n.path === path)
      if (note) {
        note.content = v.content
        note.updatedAt = new Date().toISOString()
      }
      saveStore(ws, store)
      return send(null)
    }

    case 'history_prune': {
      const path = String(args.path)
      const ws = workspacePathOf(path)
      const keep = args.keep ? Number(args.keep) : null
      const store = loadStore(ws)
      const h = store.history[path] || []
      const target = keep ? Math.min(h.length, keep) : 0
      const removed = h.length - target
      store.history[path] = h.slice(0, target)
      saveStore(ws, store)
      return send(removed)
    }

    case 'insights_report': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      const orphans: { path: string; title: string }[] = []
      const broken: { sourcePath: string; sourceTitle: string; target: string }[] = []
      const allTitles = new Set(store.notes.map((n) => n.title.toLowerCase().replace(/\.\w+$/, '')))
      for (const n of store.notes) {
        for (const link of linksOf(n.content)) {
          if (!allTitles.has(link.toLowerCase())) broken.push({ sourcePath: n.path, sourceTitle: n.title, target: link })
        }
      }
      for (const n of store.notes) {
        const incomingBacklink = store.notes.some((o) => o.path !== n.path && o.content.includes(`[[${n.title}]]`))
        if (store.notes.length > 1 && !incomingBacklink) orphans.push({ path: n.path, title: n.title })
      }
      const health = store.notes.map((n) => ({
        path: n.path,
        title: n.title,
        score: Math.min(100, 30 + n.content.length / 50 + linksOf(n.content).length * 5),
        words: n.content.split(/\s+/).filter(Boolean).length,
        linksOut: linksOf(n.content).length,
        linksIn: store.notes.filter((o) => o.path !== n.path && o.content.includes(`[[${n.title}]]`)).length,
      }))
      const totals = {
        notes: store.notes.length,
        orphans: orphans.length,
        brokenLinks: broken.length,
        duplicateGroups: 0,
        avgHealth: health.length ? health.reduce((s, h) => s + h.score, 0) / health.length : 0,
      }
      return send({ orphans, brokenLinks: broken, duplicates: [], health, totals })
    }

    case 'plugin_list': {
      const ws = String(args.workspacePath)
      const store = loadStore(ws)
      return send(store.plugins.map((p) => ({ name: p.name, path: `${ws}/plugins/${p.name}` })) as T)
    }

    case 'plugin_read': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const store = loadStore(ws)
      const p = store.plugins.find((x) => x.name === name)
      if (!p) return Promise.reject(new Error('Plugin not found'))
      return send(p.source)
    }

    case 'plugin_install': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const source = String(args.source)
      const store = loadStore(ws)
      const i = store.plugins.findIndex((x) => x.name === name)
      if (i === -1) store.plugins.push({ name, source })
      else store.plugins[i].source = source
      saveStore(ws, store)
      return send(null)
    }

    case 'plugin_uninstall': {
      const ws = String(args.workspacePath)
      const name = String(args.name)
      const store = loadStore(ws)
      store.plugins = store.plugins.filter((p) => p.name !== name)
      saveStore(ws, store)
      return send(null)
    }

    default:
      return Promise.reject(new Error(`Unhandled browser command: ${command}`))
  }
}

export const browserWorkspaceApi = {
  create: (_name: string, _parentPath: string): Promise<Workspace> =>
    browserInvoke('workspace_create', { name: _name, parentPath: _parentPath }),
  open: (_path: string): Promise<Workspace> =>
    browserInvoke('workspace_open', { path: _path }),
  recent: (): Promise<Workspace[]> => browserInvoke('workspace_recent'),
  tree: (_path: string): Promise<FileNode[]> =>
    browserInvoke('workspace_tree', { path: _path }),
}

export function throwBrowserError(api: string): never {
  throw new Error(`"${api}" is not available in browser mode — requires Tauri`)
}
