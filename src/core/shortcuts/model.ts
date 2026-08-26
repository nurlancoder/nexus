export interface ShortcutSpec {
  key: string
  /** Cmd on macOS, Ctrl elsewhere */
  mod?: boolean
  shift?: boolean
  alt?: boolean
}

export interface KeyEventLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export function matchesShortcut(
  e: KeyEventLike,
  spec: ShortcutSpec,
  isMac = false,
): boolean {
  if (e.key.toLowerCase() !== spec.key.toLowerCase()) return false
  const wantMod = spec.mod ?? false
  const hasMod = isMac ? e.metaKey : e.ctrlKey
  if (wantMod && !hasMod) return false
  if (!wantMod && hasMod) return false
  if ((spec.shift ?? false) !== e.shiftKey) return false
  if ((spec.alt ?? false) !== e.altKey) return false
  return true
}

export function formatShortcut(spec: ShortcutSpec, isMac = false): string {
  const parts: string[] = []
  if (spec.mod) parts.push(isMac ? '⌘' : 'Ctrl')
  if (spec.alt) parts.push(isMac ? '⌥' : 'Alt')
  if (spec.shift) parts.push(isMac ? '⇧' : 'Shift')
  parts.push(spec.key.length === 1 ? spec.key.toUpperCase() : spec.key)
  return parts.join(isMac ? '' : '+')
}
