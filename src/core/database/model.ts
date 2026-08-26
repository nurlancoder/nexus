import type { DatabaseRow } from '@/core/filesystem/api'

export function matchesFilter(
  row: DatabaseRow,
  filterKey?: string | null,
  filterValue?: string | null,
): boolean {
  const key = filterKey?.trim()
  const value = filterValue?.trim()
  if (!key || !value) return true
  const actual = (row.properties[key] ?? '').toLowerCase()
  const wanted = value
    .toLowerCase()
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (wanted.length === 0) return true
  return wanted.some((w) => w === actual)
}

function isNumeric(v: string): boolean {
  if (v.trim() === '') return false
  return Number.isFinite(Number(v))
}

export function compareValues(a: string, b: string): number {
  if (isNumeric(a) && isNumeric(b)) {
    const na = Number(a)
    const nb = Number(b)
    return na < nb ? -1 : na > nb ? 1 : 0
  }
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

export function sortRows(
  rows: DatabaseRow[],
  sortKey?: string | null,
  dir: 'asc' | 'desc' = 'asc',
): DatabaseRow[] {
  const key = sortKey && sortKey.trim() ? sortKey.trim() : null
  const titleCmp = (a: DatabaseRow, b: DatabaseRow) =>
    a.title.toLowerCase().localeCompare(b.title.toLowerCase())

  if (!key) {
    const sorted = [...rows].sort(titleCmp)
    return dir === 'desc' ? sorted.reverse() : sorted
  }

  const hasValue = (r: DatabaseRow) => (r.properties[key] ?? '').trim() !== ''
  const primary = rows.filter(hasValue)
  const rest = rows.filter((r) => !hasValue(r))
  primary.sort((a, b) => {
    const cmp = compareValues(a.properties[key], b.properties[key])
    return cmp !== 0 ? (dir === 'desc' ? -cmp : cmp) : titleCmp(a, b)
  })
  return [...primary, ...rest]
}

export function discoverColumns(rows: DatabaseRow[], extra: string[] = []): string[] {
  const seen = new Set<string>(extra)
  for (const row of rows) {
    for (const key of Object.keys(row.properties)) {
      if (row.properties[key] !== '') seen.add(key)
    }
  }
  return [...seen]
}

export function visibleColumns(rows: DatabaseRow[], columns: string[]): string[] {
  return columns.length > 0
    ? columns
    : discoverColumns(rows).slice(0, 8)
}
