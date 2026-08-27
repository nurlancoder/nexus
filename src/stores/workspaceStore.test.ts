import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspaceStore } from './workspaceStore'

describe('workspaceStore focus mode', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkspaceStore.setState({ focusMode: false })
  })

  it('toggleFocusMode flips focusMode on/off', () => {
    expect(useWorkspaceStore.getState().focusMode).toBe(false)
    useWorkspaceStore.getState().toggleFocusMode()
    expect(useWorkspaceStore.getState().focusMode).toBe(true)
    useWorkspaceStore.getState().toggleFocusMode()
    expect(useWorkspaceStore.getState().focusMode).toBe(false)
  })

  it('toggleFocusMode persists the value to localStorage', () => {
    useWorkspaceStore.getState().toggleFocusMode()
    expect(localStorage.getItem('nexus.focusMode')).toBe('1')
    useWorkspaceStore.getState().toggleFocusMode()
    expect(localStorage.getItem('nexus.focusMode')).toBe('0')
  })

  it('setFocusMode sets an explicit value and persists', () => {
    useWorkspaceStore.getState().setFocusMode(true)
    expect(useWorkspaceStore.getState().focusMode).toBe(true)
    expect(localStorage.getItem('nexus.focusMode')).toBe('1')
    useWorkspaceStore.getState().setFocusMode(false)
    expect(useWorkspaceStore.getState().focusMode).toBe(false)
    expect(localStorage.getItem('nexus.focusMode')).toBe('0')
  })
})
