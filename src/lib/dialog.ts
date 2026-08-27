import { open, message } from '@tauri-apps/plugin-dialog'
import { isTauri } from './tauriEnv'

export async function pickDirectory(title: string): Promise<string | null> {
  if (!isTauri()) {
    const input = window.prompt(`${title} (browser preview — enter a path):`)
    return input && input.trim() ? input.trim() : null
  }
  const result = await open({ directory: true, multiple: false, title })
  return typeof result === 'string' ? result : null
}

export async function promptInput(title: string, defaultValue = ''): Promise<string | null> {
  const result = window.prompt(title, defaultValue)
  return result && result.trim() ? result.trim() : null
}

export async function showInfo(title: string, body: string): Promise<void> {
  if (!isTauri()) {
    window.alert(body)
    return
  }
  await message(body, { title, kind: 'info' })
}