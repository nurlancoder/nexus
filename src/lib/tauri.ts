import { invoke as tauriInvoke } from '@tauri-apps/api/core'

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return tauriInvoke<T>(command, args)
}