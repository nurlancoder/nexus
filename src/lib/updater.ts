import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { isTauri } from './tauriEnv'

export interface UpdateCheckResult {
  status: 'up-to-date' | 'installed' | 'error' | 'unavailable'
  message: string
}

/** Checks the update endpoint, and if an update exists downloads,
 * installs and relaunches. Opt-in: requires a reachable endpoint. */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isTauri()) {
    return {
      status: 'unavailable',
      message: 'Updates are only available in the desktop app.',
    }
  }
  try {
    const update = await check()
    if (!update) {
      return {
        status: 'up-to-date',
        message: `NEXUS is up to date (v${__APP_VERSION__}).`,
      }
    }
    await update.downloadAndInstall()
    await relaunch()
    return {
      status: 'installed',
      message: `Update to v${update.version} installed — restarting…`,
    }
  } catch (e) {
    return {
      status: 'error',
      message: `Update check failed: ${String(e)}`,
    }
  }
}
