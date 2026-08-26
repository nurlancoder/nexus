import { join } from '@tauri-apps/api/path'
import { isTauri } from './tauriEnv'

export async function joinPath(...parts: string[]): Promise<string> {
  if (isTauri()) return join(...parts)
  return parts.join('/')
}

export function basename(path: string): string {
  const parts = path.split(/[\\/]/)
  return parts[parts.length - 1] ?? path
}

export function dirname(path: string): string {
  const parts = path.split(/[\\/]/)
  parts.pop()
  return parts.join('/') || '/'
}