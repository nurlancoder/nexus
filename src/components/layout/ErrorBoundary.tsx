import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export function ErrorFallback({
  message,
  label,
}: {
  message: string
  label?: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-[28px]" aria-hidden="true">
        ⚠️
      </span>
      <div className="text-[13px] font-medium">
        {label ? `“${label}” failed to render` : 'Something went wrong'}
      </div>
      <pre className="max-w-md overflow-auto whitespace-pre-wrap text-[11px] text-zinc-500">
        {message}
      </pre>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-zinc-800 px-3 py-1.5 text-[12px] text-zinc-100 hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Reload app
      </button>
    </div>
  )
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback message={String(this.state.error)} label={this.props.label} />
      )
    }
    return this.props.children
  }
}
