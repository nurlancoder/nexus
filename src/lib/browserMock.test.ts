import { describe, it, expect, beforeEach } from 'vitest'
import { browserInvoke } from './browserMock'

describe('browser mock backend', () => {
  const WS = '/demo/vault'

  const collectNames = (nodes: { name: string; children?: unknown[] }[], acc: string[] = []): string[] => {
    for (const n of nodes) {
      acc.push(n.name)
      if (n.children) collectNames(n.children as { name: string; children?: unknown[] }[], acc)
    }
    return acc
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('creates a workspace and seeds a welcome note', async () => {
    const ws = await browserInvoke('workspace_create', { name: 'vault', parentPath: '/demo' })
    expect((ws as { path: string }).path).toBe('/demo/vault')
    const names = collectNames((await browserInvoke('workspace_tree', { path: WS })) as { name: string; children?: unknown[] }[])
    expect(names.some((n) => n.endsWith('.md'))).toBe(true)
  })

  it('round-trips note write/read and updates the tree immediately', async () => {
    await browserInvoke('note_create', { parent: WS, title: 'Hello Nexus' })
    const path = `${WS}/Hello Nexus.md`
    const content = await browserInvoke('note_read', { path })
    expect(content).toContain('# Hello Nexus')
    await browserInvoke('note_write', { path, content: '# Hello Nexus\n\nUpdated body.\n' })
    expect(await browserInvoke('note_read', { path })).toContain('Updated body.')
  })

  it('searches indexed note content', async () => {
    await browserInvoke('note_write', { path: `${WS}/Alpha.md`, content: '# Alpha\n\nThe quick brown fox jumps.\n' })
    await browserInvoke('note_write', { path: `${WS}/Beta.md`, content: '# Beta\n\nNothing relevant here.\n' })
    const hits = (await browserInvoke('search_query', { workspacePath: WS, query: 'fox' })) as { path: string; title: string }[]
    expect(hits.map((h) => h.title)).toEqual(['Alpha'])
  })

  it('aggregates tags from body and frontmatter', async () => {
    await browserInvoke('note_write', { path: `${WS}/A.md`, content: '# A\n\n#work and #urgent\n' })
    await browserInvoke('note_write', { path: `${WS}/B.md`, content: '---\ntags: [work, project]\n---\n# B\nbody\n' })
    const tags = (await browserInvoke('tags_list', { workspacePath: WS })) as { tag: string; count: number }[]
    const work = tags.find((t) => t.tag === 'work')
    expect(work?.count).toBe(2)
    const notes = (await browserInvoke('tags_notes', { workspacePath: WS, tag: 'work' })) as { title: string }[]
    expect(notes.length).toBe(2)
  })

  it('installs and uninstalls plugins', async () => {
    await browserInvoke('plugin_install', { workspacePath: WS, name: 'foo.js', source: "nx.log('hi')" })
    const list = (await browserInvoke('plugin_list', { workspacePath: WS })) as { name: string }[]
    expect(list.map((p) => p.name)).toEqual(['foo.js'])
    expect(await browserInvoke('plugin_read', { workspacePath: WS, name: 'foo.js' })).toContain("nx.log('hi')")
    await browserInvoke('plugin_uninstall', { workspacePath: WS, name: 'foo.js' })
    expect(((await browserInvoke('plugin_list', { workspacePath: WS })) as unknown[]).length).toBe(0)
  })

  it('tracks tasks and toggles their completion', async () => {
    await browserInvoke('note_write', { path: `${WS}/Todo.md`, content: '# Todo\n- [ ] one\n- [x] two\n' })
    const tasks = (await browserInvoke('task_scan', { workspacePath: WS })) as { text: string; done: boolean; line: number }[]
    expect(tasks.length).toBe(2)
    await browserInvoke('task_toggle', { path: `${WS}/Todo.md`, line: 2, done: true })
    const after = (await browserInvoke('task_scan', { workspacePath: WS })) as { text: string; done: boolean }[]
    expect(after.find((t) => t.text === 'one')?.done).toBe(true)
  })

  it('seeds a demo workspace covering every view', async () => {
    await browserInvoke('workspace_create', { name: 'vault', parentPath: '/demo' })

    const tasks = (await browserInvoke('task_scan', { workspacePath: WS })) as { text: string; done: boolean }[]
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.some((t) => t.done)).toBe(true)

    const projects = (await browserInvoke('project_list', { workspacePath: WS })) as { name: string; openTasks: number }[]
    expect(projects.some((p) => p.name === 'Projects')).toBe(true)
    expect(projects.some((p) => p.openTasks > 0)).toBe(true)

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = [now.getFullYear(), pad(now.getMonth() + 1)]
    const events = (await browserInvoke('calendar_events', { workspacePath: WS, year: today[0], month: today[1] })) as { kind: string }[]
    expect(events.some((e) => e.kind === 'daily')).toBe(true)

    const tags = (await browserInvoke('tags_list', { workspacePath: WS })) as { tag: string }[]
    expect(tags.some((t) => t.tag === 'project')).toBe(true)

    const graph = (await browserInvoke('linking_graph', { workspacePath: WS })) as { title: string; links: string[] }[]
    expect(graph.some((n) => n.links.length > 0)).toBe(true)

    const templates = (await browserInvoke('template_list', { workspacePath: WS })) as { name: string }[]
    expect(templates.some((t) => t.name === 'Book Review')).toBe(true)

    const names = collectNames((await browserInvoke('workspace_tree', { path: WS })) as { name: string; children?: unknown[] }[])
    expect(names.some((n) => n.endsWith('.canvas'))).toBe(true)

    const dbs = (await browserInvoke('database_list', { workspacePath: WS })) as { name: string }[]
    expect(dbs.some((d) => d.name === 'Projects')).toBe(true)

    const attachments = (await browserInvoke('attachment_list', { workspacePath: WS })) as { name: string }[]
    expect(attachments.some((a) => a.name === 'hello.txt')).toBe(true)
  })
})
