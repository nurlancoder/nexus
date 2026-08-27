export interface SavedSearch {
  name: string
  query: string
}

const KEY = 'nexus.savedSearches'
const MAX = 50

function isSavedSearch(x: unknown): x is SavedSearch {
  if (!x || typeof x !== 'object') return false
  const s = x as SavedSearch
  return typeof s.name === 'string' && typeof s.query === 'string'
}

export function loadSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isSavedSearch) : []
  } catch {
    return []
  }
}

export function saveSearch(name: string, query: string): void {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return
  const trimmedName = name.trim() || trimmedQuery
  const list = loadSavedSearches().filter((s) => s.query !== trimmedQuery)
  list.unshift({ name: trimmedName, query: trimmedQuery })
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    return
  }
}

export function renameSavedSearch(index: number, name: string): void {
  const list = loadSavedSearches()
  if (index < 0 || index >= list.length) return
  const trimmed = name.trim()
  list[index] = { ...list[index], name: trimmed || list[index].query }
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    return
  }
}

export function deleteSavedSearch(index: number): void {
  const list = loadSavedSearches()
  if (index < 0 || index >= list.length) return
  list.splice(index, 1)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    return
  }
}

export function clearSavedSearches(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    return
  }
}
