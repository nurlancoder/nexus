export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window
}