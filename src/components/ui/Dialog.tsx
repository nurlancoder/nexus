import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export function Dialog({ open, onClose, title, children, maxWidth = 'max-w-md' }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const dialog = overlayRef.current?.querySelector<HTMLElement>('[role="dialog"]')
        if (!dialog) return
        const focusable = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus() }
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    // Auto-focus the dialog on open
    const dialog = overlayRef.current?.querySelector<HTMLElement>('[role="dialog"]')
    dialog?.focus()
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center nexus-fade-in"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative ${maxWidth} w-full mx-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 nexus-fade-in`}
      >
        {title && (
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

interface PromptDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  validate?: (value: string) => string | null
}

export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  placeholder = '',
  defaultValue = '',
  confirmLabel = 'Confirm',
  validate,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // oxlint-disable-next-line set-state-in-effect — reset form on open
      setValue(defaultValue)
      // oxlint-disable-next-line set-state-in-effect — reset form on open
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, defaultValue])

  const handleSubmit = useCallback(() => {
    const err = validate?.(value)
    if (err) {
      setError(err)
      return
    }
    onSubmit(value)
    onClose()
  }, [value, validate, onSubmit, onClose])

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-zinc-50 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            danger
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
