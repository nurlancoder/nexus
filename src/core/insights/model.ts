export interface HealthBucket {
  label: string
  className: string
}

export function healthBucket(score: number, isDark: boolean): HealthBucket {
  if (score >= 70) {
    return {
      label: 'Good',
      className: isDark
        ? 'bg-emerald-500/15 text-emerald-400'
        : 'bg-emerald-100 text-emerald-700',
    }
  }
  if (score >= 40) {
    return {
      label: 'Fair',
      className: isDark
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-amber-100 text-amber-700',
    }
  }
  return {
    label: 'Poor',
    className: isDark
      ? 'bg-red-500/15 text-red-400'
      : 'bg-red-100 text-red-700',
  }
}

export function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] ?? path
}
