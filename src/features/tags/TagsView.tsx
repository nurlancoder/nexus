import { useEffect } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useTagStore } from '@/stores/tagStore'
import { useTabStore } from '@/stores/tabStore'
import { EmptyStatePanel } from '@/components/ui/EmptyStatePanel'

export function TagsView() {
  const isDark = useWorkspaceStore((s) => s.theme) === 'dark'
  const { tags, notes, loading, notesLoading, error, selected, load, select } = useTagStore()
  const openNote = useTabStore((s) => s.openNote)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex h-10 shrink-0 items-center gap-2 border-b px-4 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            isDark ? 'text-zinc-500' : 'text-zinc-400'
          }`}
        >
          Tags
        </span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] ${
            isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200 text-zinc-500'
          }`}
        >
          {tags.length}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`w-52 shrink-0 overflow-y-auto border-r p-2 ${
            isDark ? 'border-zinc-800' : 'border-zinc-200'
          }`}
        >
          {loading && (
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="nexus-spin inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent" />
              <span className={`text-[12px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Loading…
              </span>
            </div>
          )}
          {!loading && tags.length === 0 && !error && (
            <p className={`px-2 py-2 text-[12px] italic ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
              No tags in this workspace.
            </p>
          )}
          <ul className="space-y-0.5">
            {tags.map((t) => {
              const active = selected === t.tag
              return (
                <li key={t.tag}>
                  <button
                    onClick={() => void select(t.tag)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                      active
                        ? isDark
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-blue-50 text-blue-600'
                        : isDark
                          ? 'text-zinc-300 hover:bg-zinc-800'
                          : 'text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <span className="truncate">#{t.tag}</span>
                    <span
                      className={`rounded-full px-1.5 text-[10px] ${
                        active
                          ? isDark
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-blue-100 text-blue-700'
                          : isDark
                            ? 'bg-zinc-800 text-zinc-500'
                            : 'bg-zinc-200 text-zinc-500'
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {error && <p className="py-2 text-[13px] text-red-500">{error}</p>}

          {!selected && !error && (
            <EmptyStatePanel
              icon="🏷"
              heading="Select a tag"
              description="Pick a tag on the left to see all notes that use it."
            />
          )}

          {selected && notesLoading && (
            <div className="flex items-center gap-2 py-4">
              <span className="nexus-spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent" />
              <span className={`text-[13px] ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Loading notes…
              </span>
            </div>
          )}

          {selected && !notesLoading && notes.length === 0 && !error && (
            <EmptyStatePanel
              icon="🏷"
              heading={`No notes with #${selected}`}
              description="No notes are tagged with this tag yet."
            />
          )}

          {selected && !notesLoading && notes.length > 0 && (
            <>
              <p
                className={`mb-2 pt-3 text-[11px] ${
                  isDark ? 'text-zinc-500' : 'text-zinc-400'
                }`}
              >
                {notes.length} note{notes.length !== 1 ? 's' : ''} tagged #{selected}
              </p>
              <div className="space-y-1.5">
                {notes.map((n) => (
                  <button
                    key={n.path}
                    onClick={() => openNote(n.path, n.title)}
                    className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      isDark
                        ? 'border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800'
                        : 'border-zinc-200 bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-[13px] font-medium ${
                          isDark ? 'text-zinc-100' : 'text-zinc-800'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span
                        className={`truncate text-[11px] ${
                          isDark ? 'text-zinc-500' : 'text-zinc-400'
                        }`}
                      >
                        {n.path}
                      </span>
                    </div>
                    {n.snippet && (
                      <p
                        className={`mt-0.5 line-clamp-2 text-[12px] ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        {n.snippet}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
