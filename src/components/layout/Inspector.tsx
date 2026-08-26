import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useNoteStore } from '@/stores/noteStore'
import { useTabStore } from '@/stores/tabStore'
import { useLinkStore } from '@/stores/linkStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useCommandPaletteStore } from '@/stores/commandPaletteStore'
import { joinFrontmatter, parseMarkdown, coerceInput } from '@/core/parser/markdown'
import { formatBytes } from '@/core/projects/model'
import type { LinkHit } from '@/core/filesystem/api'

function TypeBadge({ type }: { type: string }) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  const colors: Record<string, string> = {
    string: isDark ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-100 text-blue-700',
    number: isDark ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-100 text-amber-700',
    boolean: isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-100 text-emerald-700',
    list: isDark ? 'bg-purple-500/15 text-purple-400' : 'bg-purple-100 text-purple-700',
  }
  return (
    <span
      className={`rounded px-1 py-px text-[9px] font-semibold uppercase ${colors[type] ?? ''}`}
    >
      {type}
    </span>
  )
}

function PropertyRow({
  label,
  value,
  type,
  editing,
  draft,
  onDraftChange,
  onEditStart,
  onCommit,
  onCancel,
  onDelete,
}: {
  label: string
  value: string
  type: string
  editing: boolean
  draft: string
  onDraftChange: (v: string) => void
  onEditStart: () => void
  onCommit: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  return (
    <div className="group flex items-start justify-between gap-2 py-1">
      <span
        className={`text-[11px] font-medium ${
          isDark ? 'text-zinc-400' : 'text-zinc-500'
        }`}
      >
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-right text-[11px] break-all">
        {editing ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommit()
                if (e.key === 'Escape') onCancel()
              }}
              onBlur={onCommit}
              className={`w-32 rounded border px-1.5 py-0.5 text-right text-[11px] outline-none focus:ring-1 ${
                isDark
                  ? 'border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-blue-500/50'
                  : 'border-zinc-300 bg-white text-zinc-900 focus:ring-blue-500/40'
              }`}
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCancel}
              title="Cancel"
              className={`text-[10px] ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-400 hover:text-zinc-700'}`}
            >
              ✕
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onEditStart}
              title="Click to edit"
              className={`min-w-0 break-all ${isDark ? 'text-zinc-200 hover:text-blue-400' : 'text-zinc-700 hover:text-blue-600'}`}
            >
              {value}
            </button>
            <TypeBadge type={type} />
            <button
              onClick={onDelete}
              title="Delete property"
              className={`hidden shrink-0 text-[10px] group-hover:block ${isDark ? 'text-zinc-600 hover:text-red-400' : 'text-zinc-400 hover:text-red-600'}`}
            >
              🗑
            </button>
          </>
        )}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  return (
    <div className={`border-t px-3 py-3 ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
      <p
        className={`mb-2 text-[10px] font-semibold uppercase tracking-widest ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  const { theme } = useWorkspaceStore()
  const isDark = theme === 'dark'
  return (
    <p className={`text-[11px] italic ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
      {text}
    </p>
  )
}

function LinkHitRow({ hit }: { hit: LinkHit }) {
  const { theme } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const isDark = theme === 'dark'
  return (
    <button
      onClick={() => openNote(hit.path, hit.title)}
      className={`block w-full rounded-md px-2 py-1.5 text-left transition-colors ${
        isDark ? 'hover:bg-zinc-800' : 'hover:bg-zinc-200'
      }`}
    >
      <span
        className={`block truncate text-[12px] font-medium ${
          isDark ? 'text-zinc-200' : 'text-zinc-700'
        }`}
      >
        {hit.title}
      </span>
      <span
        className={`block truncate text-[11px] ${
          isDark ? 'text-zinc-500' : 'text-zinc-400'
        }`}
      >
        {hit.snippet}
      </span>
    </button>
  )
}

function formatValue(value: string | number | boolean | string[] | undefined): {
  text: string
  type: string
} {
  if (value === undefined || value === '') return { text: '—', type: 'string' }
  if (Array.isArray(value))
    return {
      text: value.length > 0 ? value.join(', ') : '—',
      type: 'list',
    }
  if (typeof value === 'boolean') return { text: String(value), type: 'boolean' }
  if (typeof value === 'number') return { text: String(value), type: 'number' }
  return { text: value, type: 'string' }
}

export function Inspector() {
  const { theme, inspectorVisible, toggleInspector, inspectorWidth } = useWorkspaceStore()
  const docs = useNoteStore((s) => s.docs)
  const activeTab = useTabStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId),
  )
  const isDark = theme === 'dark'

  const notePath = activeTab?.kind === 'note' ? activeTab.notePath : undefined
  const doc = notePath ? docs[notePath] : undefined
  const resolution = useLinkStore((s) => (notePath ? s.resolutions[notePath] : undefined))
  const linkLoading = useLinkStore((s) => (notePath ? s.loading[notePath] : false))

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [prevPath, setPrevPath] = useState(notePath)
  if (prevPath !== notePath) {
    setPrevPath(notePath)
    setEditingKey(null)
    setDraft('')
    setAdding(false)
    setNewKey('')
    setNewValue('')
  }

  const setProperty = (key: string, value: ReturnType<typeof coerceInput> | null) => {
    if (!notePath) return
    void useNoteStore.getState().setProperty(notePath, key, value)
  }

  const commitEdit = () => {
    if (!editingKey) return
    const key = editingKey
    setEditingKey(null)
    setProperty(key, coerceInput(draft))
  }


  useEffect(() => {
    if (notePath) void useLinkStore.getState().resolve(notePath)
  }, [notePath])

  const history = useHistoryStore()
  useEffect(() => {
    if (notePath) void useHistoryStore.getState().load(notePath)
  }, [notePath])

  const parsed = useMemo(() => {
    if (!doc) return null
    const full = joinFrontmatter(doc.frontmatter, doc.content)
    return parseMarkdown(full)
  }, [doc])

  if (!inspectorVisible) return null

  return (
    <aside
      style={{ width: inspectorWidth }}
      className={`flex shrink-0 flex-col border-l ${
        isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 ${
          isDark ? 'border-zinc-800' : 'border-zinc-200'
        }`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          Inspector
        </span>
        <button
          onClick={toggleInspector}
          className={`text-[12px] ${
            isDark ? 'text-zinc-500 hover:text-zinc-200' : 'text-zinc-400 hover:text-zinc-800'
          }`}
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!parsed ? (
          <Empty text="Open a note to inspect" />
        ) : (
          <>
            <Section title="Properties">
              {Object.keys(parsed.frontmatter).length === 0 ? (
                <Empty text="No properties" />
              ) : (
                <div className="space-y-0.5">
                  {Object.entries(parsed.frontmatter).map(([key, value]) => {
                    const { text, type } = formatValue(value)
                    const editing = editingKey === key
                    return (
                      <PropertyRow
                        key={key}
                        label={key}
                        value={text}
                        type={type}
                        editing={editing}
                        draft={editing ? draft : ''}
                        onDraftChange={setDraft}
                        onEditStart={() => {
                          setEditingKey(key)
                          setDraft(
                            Array.isArray(value)
                              ? value.join(', ')
                              : typeof value === 'undefined'
                                ? ''
                                : String(value),
                          )
                        }}
                        onCommit={commitEdit}
                        onCancel={() => setEditingKey(null)}
                        onDelete={() => {
                          if (editingKey === key) setEditingKey(null)
                          setProperty(key, null)
                        }}
                      />
                    )
                  })}
                </div>
              )}
              {adding ? (
                <form
                  className="mt-2 flex flex-col gap-1"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const key = newKey.trim()
                    if (!key || !notePath) return
                    useNoteStore.getState().setProperty(notePath, key, coerceInput(newValue))
                    setNewKey('')
                    setNewValue('')
                    setAdding(false)
                  }}
                >
                  <input
                    autoFocus
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setAdding(false)
                    }}
                    placeholder="Name"
                    className={`w-full rounded border px-1.5 py-0.5 text-[11px] outline-none ${
                      isDark
                        ? 'border-zinc-600 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500'
                        : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
                    }`}
                  />
                  <input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setAdding(false)
                    }}
                    placeholder="Value (comma = list)"
                    className={`w-full rounded border px-1.5 py-0.5 text-[11px] outline-none ${
                      isDark
                        ? 'border-zinc-600 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500'
                        : 'border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400'
                    }`}
                  />
                  <div className="flex gap-1">
                    <button
                      type="submit"
                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className={`rounded px-2 py-0.5 text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className={`mt-2 text-[11px] ${isDark ? 'text-zinc-500 hover:text-blue-400' : 'text-zinc-400 hover:text-blue-600'}`}
                >
                  + Add property
                </button>
              )}
            </Section>

            <Section title="Backlinks">
              {linkLoading ? (
                <Empty text="Resolving…" />
              ) : resolution && resolution.backlinks.length > 0 ? (
                <div className="space-y-0.5">
                  {resolution.backlinks.map((h) => (
                    <LinkHitRow key={h.path} hit={h} />
                  ))}
                </div>
              ) : (
                <Empty text="No backlinks" />
              )}
            </Section>

            <Section title="Unlinked Mentions">
              {linkLoading ? (
                <Empty text="Resolving…" />
              ) : resolution && resolution.mentions.length > 0 ? (
                <div className="space-y-0.5">
                  {resolution.mentions.map((h) => (
                    <LinkHitRow key={h.path} hit={h} />
                  ))}
                </div>
              ) : (
                <Empty text="No unlinked mentions" />
              )}
            </Section>

            <Section title="Outgoing Links">
              {parsed.links.length === 0 ? (
                <Empty text="No links" />
              ) : (
                <ul className="space-y-1">
                  {parsed.links.map((l, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-1 text-[11px] ${
                        isDark ? 'text-zinc-200' : 'text-zinc-700'
                      }`}
                    >
                      <span>{l.embed ? '! ' : ''}[[{l.target}]]</span>
                      {l.alias && (
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>
                          → {l.alias}
                        </span>
                      )}
                      {l.section && (
                        <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>
                          #{l.section}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Embeds">
              {parsed.embeds.length === 0 ? (
                <Empty text="No embeds" />
              ) : (
                <ul className="space-y-1">
                  {parsed.embeds.map((e, i) => (
                    <li
                      key={i}
                      className={`text-[11px] ${
                        isDark ? 'text-zinc-200' : 'text-zinc-700'
                      }`}
                    >
                      ![[{e}]]
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Tags">
              {parsed.tags.length === 0 ? (
                <Empty text="No tags" />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {parsed.tags.map((t) => (
                    <span
                      key={t}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        isDark
                          ? 'bg-zinc-800 text-zinc-300'
                          : 'bg-zinc-200 text-zinc-600'
                      }`}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Metadata">
              <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>Words</span>
                <span className={isDark ? 'text-zinc-200' : 'text-zinc-700'}>
                  {parsed.wordCount}
                </span>
                <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>Headings</span>
                <span className={isDark ? 'text-zinc-200' : 'text-zinc-700'}>
                  {parsed.headings.length}
                </span>
                <span className={isDark ? 'text-zinc-500' : 'text-zinc-400'}>Tasks</span>
                <span className={isDark ? 'text-zinc-200' : 'text-zinc-700'}>
                  {parsed.tasks.filter((t) => t.checked).length}/{parsed.tasks.length}
                </span>
              </div>
            </Section>

            <Section title="History">
              {history.versions.length === 0 ? (
                <Empty text="No saved versions yet" />
              ) : (
                <div className="space-y-1">
                  {history.versions.map((v) => (
                    <div key={v.id}>
                      <button
                        onClick={() => notePath && void history.select(v.id)}
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-[11px] ${
                          history.selectedId === v.id
                            ? 'bg-blue-500/15 text-blue-500'
                            : isDark
                              ? 'text-zinc-400 hover:bg-zinc-800'
                              : 'text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        <span>{v.createdAt.slice(0, 16)}</span>
                        <span className={isDark ? 'text-zinc-600' : 'text-zinc-400'}>
                          {formatBytes(v.size)}
                        </span>
                      </button>
                      {history.selectedId === v.id && (
                        <div className="mt-1 space-y-2 px-2 pb-1">
                          <pre
                            className={`max-h-40 overflow-auto rounded p-2 text-[10px] leading-relaxed ${
                              isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-white text-zinc-700'
                            }`}
                          >
                            {history.preview}
                          </pre>
                          <button
                            onClick={async () => {
                              if (!notePath) return
                              const ok = await history.restore(notePath, v.id)
                              if (ok) void useNoteStore.getState().load(notePath)
                            }}
                            className={`w-full rounded border px-2 py-1 text-[11px] ${
                              isDark
                                ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                                : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            ⟲ Restore this version
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {history.error && (
                    <p className="px-2 text-[11px] text-red-500">{history.error}</p>
                  )}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
      <div
        className={`flex items-center justify-between border-t px-3 py-2 text-[11px] ${
          isDark ? 'border-zinc-800 text-zinc-500' : 'border-zinc-200 text-zinc-400'
        }`}
      >
        <span>v0.1.0</span>
        <button
          onClick={() => useCommandPaletteStore.getState().open()}
          className="hover:opacity-80"
        >
          ⌘K
        </button>
      </div>
    </aside>
  )
}