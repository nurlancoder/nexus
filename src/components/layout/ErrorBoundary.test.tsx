import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorFallback } from './ErrorBoundary'

describe('ErrorFallback', () => {
  it('renders error fallback with label', () => {
    const html = renderToStaticMarkup(
      <ErrorFallback error={new Error('boom at line 1')} label="Graph" />,
    )
    expect(html).toContain('Graph')
    expect(html).toContain('boom at line 1')
    expect(html).toContain('Reload app')
    expect(html).toContain('Copy error')
  })

  it('renders generic heading without a label', () => {
    const html = renderToStaticMarkup(
      <ErrorFallback error={new Error('test')} />,
    )
    expect(html).toContain('Something went wrong')
  })

  it('shows Try again button when onRetry provided', () => {
    const onRetry = vi.fn()
    const html = renderToStaticMarkup(
      <ErrorFallback error={new Error('test')} onRetry={onRetry} />,
    )
    expect(html).toContain('Try again')
  })

  it('does not show Try again without onRetry', () => {
    const html = renderToStaticMarkup(
      <ErrorFallback error={new Error('test')} />,
    )
    expect(html).not.toContain('Try again')
  })
})
