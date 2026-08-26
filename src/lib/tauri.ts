import { isTauri } from './tauriEnv'

let tauriInvoke: ((command: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null

async function getInvoke() {
  if (tauriInvoke) return tauriInvoke
  if (!isTauri()) {
    throw new Error('Tauri API is not available in browser mode')
  }
  const mod = await import('@tauri-apps/api/core')
  tauriInvoke = mod.invoke
  return tauriInvoke
}

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const fn = await getInvoke()
  return fn(command, args) as Promise<T>
}
