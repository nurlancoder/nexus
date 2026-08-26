import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTabStore } from '@/stores/tabStore'
import { useTemplateStore } from '@/stores/templateStore'
import { refreshTree } from '@/features/notes/actions'

export function TemplatesView() {
  const { theme } = useWorkspaceStore()
  const openNote = useTabStore((s) => s.openNote)
  const templates = useTemplateStore((s) => s.templates)
  const selectedName = useTemplateStore((s) => s.selectedName)
  const preview = useTemplateStore((s) => s.preview)
  const loading = useTemplateStore((s) => s.loading)
  const error = useTemplateStore((s) => s.error)
  const isDark = theme === 'dark'

  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void useTemplateStore.getState().load()
  }, [])

  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`
  const mutedText = isDark ? 'text-zinc-500' : 'text-zinc-400'

  const create = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const path = await useTemplateStore.getState().createNote(title)
      if (path) {
        await refreshTree()
        openNote(path, title.trim())
        setTitle('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Templates</span>
        <span className={`text-[11px] ${mutedText}`}>{templates.length} in 07-Templates</span>
        <div className="flex-1" />
        <button onClick={() => void useTemplateStore.getState().load()} className={btn}>
          Refresh
        </button>
      </div>

      {error && <p className="px-3 py-1.5 text-[12px] text-red-500">{error}</p>}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-56 shrink-0 flex-col overflow-auto border-r p-2" style={{ borderColor: isDark ? '#27272a' : '#e4e4e7' }}>
          {loading && <p className={`p-2 text-[12px] ${mutedText}`}>Loading…</p>}
          {!loading && templates.length === 0 && (
            <p className={`p-2 text-[12px] ${mutedText}`}>
              No templates. Add .md files to `07-Templates`.
            </p>
          )}
          {templates.map((t) => (
            <button
              key={t.path}
              onClick={() => void useTemplateStore.getState().select(t.name)}
              className={`mb-0.5 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors ${
                t.name === selectedName
                  ? isDark
                    ? 'bg-blue-500/15 text-blue-300'
                    : 'bg-blue-100 text-blue-700'
                  : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800'
                    : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <div className="truncate font-medium">{t.name.replace(/\.(md|markdown)$/i, '')}</div>
              <div className={`truncate text-[10px] ${mutedText}`}>{t.name}</div>
            </button>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 ${
              isDark ? 'border-zinc-800' : 'border-zinc-200'
            }`}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create()
              }}
              placeholder="New note title…"
              disabled={!selectedName}
              className={`min-w-40 flex-1 rounded-md border px-2 py-1 text-[12px] outline-none disabled:opacity-50 ${
                isDark
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-500'
                  : 'border-zinc-300 bg-white text-zinc-800 placeholder:text-zinc-400'
              }`}
            />
            <button
              onClick={() => void create()}
              disabled={!title.trim() || !selectedName || busy}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create note'}
            </button>
            <span className={`text-[11px] ${mutedText}`}>→ saved to 00-Inbox</span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!selectedName && (
              <p className={`text-[13px] ${mutedText}`}>Select a template.</p>
            )}
            {selectedName && (
              <>
                <div className={`mb-2 text-[11px] font-semibold uppercase tracking-widest ${mutedText}`}>
                  Preview · {selectedName}
                </div>
                <pre
                  className={`whitespace-pre-wrap rounded-lg border p-3 font-mono text-[12px] leading-relaxed ${
                    isDark
                      ? 'border-zinc-800 bg-zinc-900/60 text-zinc-300'
                      : 'border-zinc-200 bg-white text-zinc-700'
                  }`}
                >
                  {preview}
                </pre>
                <p className={`mt-2 text-[11px] ${mutedText}`}>
                  Variables: {'{{title}}'}, {'{{date}}'}, {'{{time}}'} are substituted on create.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
