import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorFallback } from './ErrorBoundary'

describe('ErrorFallback', () => {
  it('renders the error message and a reload button', () => {
    const html = renderToStaticMarkup(
      <ErrorFallback message="boom at line 1" label="Graph" />,
    )
    expect(html).toContain('“Graph” failed to render')
    expect(html).toContain('boom at line 1')
    expect(html).toContain('Reload app')
  })

  it('uses a generic heading without a label', () => {
    const html = renderToStaticMarkup(<ErrorFallback message="x" />)
    expect(html).toContain('Something went wrong')
  })
})
