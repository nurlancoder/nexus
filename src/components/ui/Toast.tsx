import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

// oxlint-disable-next-line react(only-export-components) — standard Context + Provider pattern
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    timers.current.delete(id)
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++toastId
      setToasts((prev) => {
        const next = [...prev, { id, message, type }]
        return next.length > 3 ? next.slice(-3) : next
      })
      const timer = setTimeout(() => dismiss(id), 3000)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const colors: Record<ToastType, string> = {
    success: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    error: 'border-red-500/40 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
    info: 'border-blue-500/40 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  }

  return (
    <div
      role="status"
      onClick={onDismiss}
      className={`pointer-events-auto cursor-pointer animate-slide-in-right rounded-lg border px-4 py-2.5 text-[13px] shadow-lg backdrop-blur-sm ${colors[toast.type]}`}
    >
      {toast.message}
    </div>
  )
}
