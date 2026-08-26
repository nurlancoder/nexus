import { describe, it, expect, vi, beforeEach } from 'vitest'
import { noteApi } from '@/core/filesystem/api'
import { useNoteStore } from './noteStore'
import { pluginBus } from '@/core/plugins/bus'

vi.mock('@/core/filesystem/api', () => ({
  noteApi: {
    read: vi.fn(),
    write: vi.fn(async () => null),
  },
  linkingApi: {
    resolve: vi.fn(),
  },
}))

const mockedRead = vi.mocked(noteApi.read)
const mockedWrite = vi.mocked(noteApi.write)

const SAMPLE = '---\ntitle: My Note\ntags:\n  - a\n---\n\n# My Note\n\nbody text'

describe('noteStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useNoteStore.setState({ docs: {} })
  })

  it('load splits frontmatter, extracts title and stores saved snapshot', async () => {
    mockedRead.mockResolvedValue(SAMPLE)
    await useNoteStore.getState().load('/ws/note.md')

    const doc = useNoteStore.getState().docs['/ws/note.md']
    expect(doc.loading).toBe(false)
    expect(doc.title).toBe('My Note')
    expect(doc.frontmatter).toContain('title: My Note')
    expect(doc.content).toBe('# My Note\n\nbody text')
    expect(doc.saved).toBe(doc.content)
  })

  it('load keeps placeholder without loading flag on read failure', async () => {
    mockedRead.mockRejectedValue(new Error('missing'))
    await useNoteStore.getState().load('/ws/gone.md')
    const doc = useNoteStore.getState().docs['/ws/gone.md']
    expect(doc?.loading).toBe(false)
  })

  it('setContent marks doc dirty until saved', async () => {
    mockedRead.mockResolvedValue(SAMPLE)
    await useNoteStore.getState().load('/ws/note.md')
    expect(useNoteStore.getState().isDirty('/ws/note.md')).toBe(false)

    useNoteStore.getState().setContent('/ws/note.md', '# changed')
    expect(useNoteStore.getState().isDirty('/ws/note.md')).toBe(true)

    mockedWrite.mockResolvedValue(null)
    await useNoteStore.getState().save('/ws/note.md')
    expect(useNoteStore.getState().isDirty('/ws/note.md')).toBe(false)
  })

  it('save persists joined frontmatter + content and emits note:save', async () => {
    mockedRead.mockResolvedValue('---\ntitle: T\n---\n\nbody')
    await useNoteStore.getState().load('/ws/t.md')
    useNoteStore.getState().setContent('/ws/t.md', 'new body')

    const events: string[] = []
    pluginBus.on('note:save', (d) => events.push(d.path))

    await useNoteStore.getState().save('/ws/t.md')
    const written = mockedWrite.mock.calls[0][1]
    expect(written.startsWith('---\ntitle: T\n---\n')).toBe(true)
    expect(written.endsWith('new body')).toBe(true)
    expect(events).toEqual(['/ws/t.md'])
  })

  it('setProperty rewrites frontmatter, updates title and saves', async () => {
    mockedRead.mockResolvedValue('---\ntitle: Old\nstatus: draft\n---\n\ntext')
    await useNoteStore.getState().load('/ws/p.md')

    await useNoteStore.getState().setProperty('/ws/p.md', 'title', 'New Title')
    const doc = useNoteStore.getState().docs['/ws/p.md']
    expect(doc.title).toBe('New Title')
    expect(mockedWrite).toHaveBeenCalledTimes(1)
    const written = mockedWrite.mock.calls[0][1]
    expect(written).toContain('title: "New Title"')
    expect(written).toContain('status: "draft"')
  })

  it('setProperty removes key when value is null', async () => {
    mockedRead.mockResolvedValue('---\ntitle: T\nstatus: draft\n---\n\ntext')
    await useNoteStore.getState().load('/ws/p.md')
    await useNoteStore.getState().setProperty('/ws/p.md', 'status', null)
    const written = mockedWrite.mock.calls[0][1]
    expect(written).not.toContain('status')
  })

  it('close drops the doc and isDirty is false for unknown paths', async () => {
    mockedRead.mockResolvedValue(SAMPLE)
    await useNoteStore.getState().load('/ws/note.md')
    useNoteStore.getState().close('/ws/note.md')
    expect(useNoteStore.getState().docs['/ws/note.md']).toBeUndefined()
    expect(useNoteStore.getState().isDirty('/ws/note.md')).toBe(false)
  })
})
