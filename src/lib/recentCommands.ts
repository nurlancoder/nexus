const KEY = 'nexus.recentCommands'
const MAX = 5

export function loadRecentCommands(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

export function recordRecentCommand(id: string): void {
  const list = loadRecentCommands().filter((x) => x !== id)
  list.unshift(id)
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    return
  }
}

export function clearRecentCommands(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    return
  }
}
