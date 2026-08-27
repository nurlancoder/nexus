import { describe, it, expect, beforeEach } from 'vitest'
import { browserInvoke } from './browserMock'

describe('browser mock backend', () => {
  const WS = '/demo/vault'

  beforeEach(() => {
    localStorage.clear()
  })

  it('creates a workspace and seeds a welcome note', async () => {
    const ws = await browserInvoke('workspace_create', { name: 'vault', parentPath: '/demo' })
    expect((ws as { path: string }).path).toBe('/demo/vault')
    const tree = (await browserInvoke('workspace_tree', { path: WS })) as { name: string }[]
    expect(tree.some((n) => n.name.endsWith('.md'))).toBe(true)
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
})
