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
              className={`flex h-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center ${
                dragOver ? 'border-blue-500' : isDark ? 'border-zinc-800' : 'border-zinc-300'
              }`}
            >
              <div className="text-5xl opacity-40">📎</div>
              <p className={`max-w-xs text-[13px] ${mutedText}`}>
                Drag & drop files here, or click Upload. Files are stored in the
                workspace's `06-Attachments` folder.
              </p>
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
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`Delete "${item.name}"?`)) {
                      void useAttachmentStore.getState().remove(item.path)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation()
                      if (window.confirm(`Delete "${item.name}"?`)) {
                        void useAttachmentStore.getState().remove(item.path)
                      }
                    }
                  }}
                  className={`absolute top-1.5 right-1.5 hidden rounded px-1 text-[11px] group-hover:block ${
                    isDark ? 'text-red-400 hover:bg-red-500/20' : 'text-red-500 hover:bg-red-100'
                  }`}
                >
                  🗑
                </span>
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
  if (prevPath !== path) {
    setPrevPath(path)
    setData(null)
    setFailed(false)
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
        >
          ⧉ MD
        </button>
        <button
          onClick={() => useAttachmentStore.getState().select(null)}
          className={`rounded px-1.5 py-1 text-[12px] ${
            isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-200 text-zinc-600'
          }`}
        >
          ✕
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3">
        {kind === 'image' && src && (
          <img src={src} alt={name} className="max-h-full max-w-full rounded-md object-contain" />
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
