import { useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useAttachmentStore } from '@/stores/attachmentStore'
import { attachmentApi } from '@/core/filesystem/api'
import { formatBytes } from '@/core/projects/model'

const KIND_ICON: Record<string, string> = {
  image: '🖼',
  pdf: '📕',
  other: '📎',
}

function mimeFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'svg':
      return 'image/svg+xml'
    case 'bmp':
      return 'image/bmp'
    case 'ico':
      return 'image/x-icon'
    case 'pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}

export function AttachmentsView() {
  const { theme } = useWorkspaceStore()
  const items = useAttachmentStore((s) => s.items)
  const loading = useAttachmentStore((s) => s.loading)
  const error = useAttachmentStore((s) => s.error)
  const selectedPath = useAttachmentStore((s) => s.selectedPath)
  const isDark = theme === 'dark'

  const [dragOver, setDragOver] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    void useAttachmentStore.getState().load()
  }, [])

  const selected = useMemo(
    () => items.find((i) => i.path === selectedPath) ?? null,
    [items, selectedPath],
  )

  const btn = `rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
    isDark
      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
  }`
  const mutedText = isDark ? 'text-zinc-500' : 'text-zinc-400'

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      void useAttachmentStore.getState().upload(e.dataTransfer.files)
    }
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      <div
        className={`flex h-11 shrink-0 items-center gap-2 border-b px-3 ${
          isDark ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-zinc-50'
        }`}
      >
        <span className="text-[13px] font-medium">Attachments</span>
        <span className={`text-[11px] ${mutedText}`}>{items.length} in 06-Attachments</span>
        <div className="flex-1" />
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void useAttachmentStore.getState().upload(e.target.files)
              e.target.value = ''
            }
          }}
        />
        <button onClick={() => fileInput.current?.click()} className={btn}>
          Upload
        </button>
        <button onClick={() => void useAttachmentStore.getState().load()} className={btn}>
          Refresh
        </button>
      </div>

      {error && <p className="px-3 py-1.5 text-[12px] text-red-500">{error}</p>}

      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-3">
          {loading && <p className={`text-[13px] ${mutedText}`}>Loading attachments…</p>}
          {!loading && items.length === 0 && (
            <div
              className={`flex h-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-500/5'
                  : isDark
                    ? 'border-zinc-700 bg-zinc-900/30'
                    : 'border-zinc-300 bg-zinc-50'
              }`}
            >
              <div className="text-5xl opacity-40">📎</div>
              <p className={`text-[14px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                No attachments yet
              </p>
              <p className={`max-w-xs text-[12px] ${mutedText}`}>
                Drag & drop files here, or click Upload. Files are stored in your workspace's `06-Attachments` folder.
              </p>
            </div>
          )}
          {items.length > 0 && (
            <div className={`mb-3 rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-500/5'
                : isDark
                  ? 'border-zinc-700/50 bg-zinc-900/20'
                  : 'border-zinc-200 bg-zinc-50/50'
            }`}>
              <p className={`text-[12px] ${mutedText}`}>Drop files here to upload</p>
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {items.map((item) => (
              <button
                key={item.path}
                onClick={() => useAttachmentStore.getState().select(item.path)}
                className={`group relative rounded-lg border p-3 text-left transition-colors ${
                  item.path === selectedPath
                    ? isDark
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-blue-500 bg-blue-50'
                    : isDark
                      ? 'border-zinc-800 bg-zinc-900 hover:border-zinc-600'
                      : 'border-zinc-200 bg-white hover:border-zinc-400'
                }`}
              >
                <div className="mb-1 text-2xl">{KIND_ICON[item.kind] ?? '📎'}</div>
                <div className={`truncate text-[12px] ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`} title={item.name}>
                  {item.name}
                </div>
                <div className={`mt-0.5 text-[10px] ${mutedText}`}>{formatBytes(item.size)}</div>
                <span
                  role="button"
                  tabIndex={0}
                  title="Delete attachment"
                  aria-label="Delete attachment"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(confirmDelete === item.path ? null : item.path)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      setConfirmDelete(confirmDelete === item.path ? null : item.path)
                    }
                  }}
                  className={`absolute top-1.5 right-1.5 hidden rounded px-1 text-[11px] group-hover:block ${
                    isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'
                  }`}
                >
                  🗑
                </span>
                {confirmDelete === item.path && (
                  <div
                    className={`absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg ${
                      isDark ? 'bg-zinc-900/95' : 'bg-white/95'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        void useAttachmentStore.getState().remove(item.path)
                        setConfirmDelete(null)
                      }}
                      className="rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-red-600"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className={`rounded-md px-2.5 py-1 text-[11px] transition-colors ${
                        isDark ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-blue-500/10">
            <span className="rounded-lg border-2 border-dashed border-blue-500 px-6 py-4 text-[13px] font-medium text-blue-500">
              Drop files to add to 06-Attachments
            </span>
          </div>
        )}

        {selected && (
          <AttachmentPreview path={selected.path} name={selected.name} kind={selected.kind} isDark={isDark} mutedText={mutedText} />
        )}
      </div>
    </div>
  )
}

function AttachmentPreview({
  path,
  name,
  kind,
  isDark,
  mutedText,
}: {
  path: string
  name: string
  kind: string
  isDark: boolean
  mutedText: string
}) {
  const [data, setData] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [prevPath, setPrevPath] = useState(path)
  const [imgZoom, setImgZoom] = useState(1)
  if (prevPath !== path) {
    setPrevPath(path)
    setData(null)
    setFailed(false)
    setImgZoom(1)
  }

  useEffect(() => {
    let alive = true
    attachmentApi
      .read(path)
      .then((d) => {
        if (alive) setData(d)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [path])

  const src = data ? `data:${mimeFor(name)};base64,${data}` : null

  return (
    <div
      className={`flex w-80 shrink-0 flex-col border-l ${
        isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-200 bg-zinc-50'
      }`}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: isDark ? '#27272a' : '#e4e4e7' }}>
        <span className={`min-w-0 flex-1 truncate text-[12px] ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`} title={name}>
          {name}
        </span>
        <button
          onClick={() =>
            void navigator.clipboard
              .writeText(`![${name}](../06-Attachments/${encodeURIComponent(name)})`)
              .then(() => useAttachmentStore.getState().select(null))
          }
          className={`rounded px-1.5 py-1 text-[11px] transition-colors ${
            isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
          }`}
          title="Copy markdown embed to clipboard"
          aria-label="Copy markdown embed to clipboard"
        >
          ⧉ MD
        </button>
        <button
          onClick={() => useAttachmentStore.getState().select(null)}
          title="Close preview"
          aria-label="Close preview"
          className={`rounded px-1.5 py-1 text-[12px] ${
            isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
          }`}
        >
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
        {kind === 'image' && src && (
          <div className="flex flex-col items-center gap-2">
            <div className="overflow-auto max-h-full max-w-full rounded-md">
              <img
                src={src}
                alt={name}
                className="rounded-md object-contain transition-transform duration-200"
                style={{ transform: `scale(${imgZoom})`, transformOrigin: 'center center' }}
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setImgZoom((z) => Math.max(0.25, z - 0.25))}
                title="Zoom out"
                aria-label="Zoom out"
                className={`rounded px-1.5 py-0.5 text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}
              >
                −
              </button>
              <span className={`w-10 text-center text-[10px] tabular-nums ${mutedText}`}>
                {Math.round(imgZoom * 100)}%
              </span>
              <button
                onClick={() => setImgZoom((z) => Math.min(3, z + 0.25))}
                title="Zoom in"
                aria-label="Zoom in"
                className={`rounded px-1.5 py-0.5 text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}
              >
                +
              </button>
              <button
                onClick={() => setImgZoom(1)}
                className={`rounded px-1.5 py-0.5 text-[10px] ${isDark ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-600 hover:bg-zinc-300'}`}
              >
                Reset
              </button>
            </div>
          </div>
        )}
        {kind === 'pdf' && src && (
          <iframe src={src} title={name} className="h-full w-full rounded-md border-0 bg-white" />
        )}
        {kind !== 'image' && kind !== 'pdf' && (
          <div className="text-center">
            <div className="text-4xl opacity-40">📎</div>
            <p className={`mt-2 text-[11px] ${mutedText}`}>No preview available</p>
          </div>
        )}
        {(data === null || failed) && (kind === 'image' || kind === 'pdf') && !failed && (
          <p className={`text-[11px] ${mutedText}`}>Loading preview…</p>
        )}
        {failed && <p className="text-[11px] text-red-500">Failed to load preview</p>}
      </div>
    </div>
  )
}
