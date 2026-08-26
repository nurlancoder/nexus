import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export function ErrorFallback({
  error,
  label,
  onRetry,
}: {
  error: Error
  label?: string
  onRetry?: () => void
}) {
  const message = String(error)
  const stack = error.stack ?? ''

  const copyError = () => {
    const text = [
      label ? `Error in "${label}"` : 'Error',
      error.message,
      '',
      stack,
    ].join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-[28px]" aria-hidden="true">
        ⚠️
      </span>
      <div className="text-[13px] font-medium">
        {label ? `"${label}" failed to render` : 'Something went wrong'}
      </div>
      {error.message && (
        <div className="max-w-md text-[12px] text-zinc-400 dark:text-zinc-500">
          {error.message}
        </div>
      )}
      <pre className="max-w-md overflow-auto whitespace-pre-wrap text-[11px] text-zinc-500">
        {message}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={copyError}
          className="rounded-md border px-3 py-1.5 text-[12px] transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
        >
          Copy error
        </button>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] text-white transition-colors hover:bg-blue-500"
          >
            Try again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="rounded-md border px-3 py-1.5 text-[12px] transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
        >
          Reload app
        </button>
      </div>
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
        <ErrorFallback
          error={this.state.error}
          label={this.props.label}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
