import { commands } from '@/core/commands/registry'
import { noteApi, pluginApi } from '@/core/filesystem/api'
import { useNoteStore } from '@/stores/noteStore'
import { useTabStore } from '@/stores/tabStore'
import { WORKER_SOURCE } from './worker-source'
import { pluginBus, type PluginEventHandler, type PluginEventName } from './bus'

export interface PluginStatus {
  name: string
  enabled: boolean
  error: string | null
}

export interface PluginApi {
  registerCommand(spec: { id: string; title: string; run: () => void }): void
  on(event: 'note:open' | 'note:save', handler: PluginEventHandler): void
  getActiveNote(): Promise<{
    path: string
    title: string
    content: string
  } | null>
  readNote(path: string): Promise<string>
  writeNote(path: string, content: string): Promise<void>
  log(message: string): void
  today(): string
}

export interface ManagedWorker {
  postMessage(data: unknown): void
  onMessage(fn: (data: unknown) => void): void
  onError(fn: (err: unknown) => void): void
  terminate(): void
}

export type WorkerFactory = (source: string) => ManagedWorker

let _workerFactory: WorkerFactory | null = null

export function _setWorkerFactory(factory: WorkerFactory): void {
  _workerFactory = factory
}

export function createManagedWorker(_source: string): ManagedWorker {
  if (_workerFactory) return _workerFactory(_source)
  const w = new Worker('/plugin-worker.js')
  return {
    postMessage: (data) => w.postMessage(data),
    onMessage: (fn) => {
      w.onmessage = (e) => fn(e.data)
    },
    onError: (fn) => {
      w.onerror = (e) => fn(e)
    },
    terminate: () => {
      w.terminate()
    },
  }
}

// --- Worker → Host message types ---

type WorkerToHostMessage =
  | { type: 'ready' }
  | { type: 'error'; error: string }
  | { type: 'call'; id: number; method: string; args: unknown[] }
  | { type: 'register'; id: string; title: string }
  | { type: 'subscribe'; event: string; handlerId: number }
  | { type: 'log'; message: string }

// --- Module state ---

const DISABLED_KEY = 'nexus.plugins.disabled'
const COMMAND_PREFIX = 'plugin:'
const logs: string[] = []

export function clearLogs(): void {
  logs.length = 0
}

interface PluginHandle {
  worker: ManagedWorker
  commandIds: string[]
  unsubs: Array<() => void>
}

const activeWorkers = new Map<string, PluginHandle>()

export function pluginLogs(): string[] {
  return [...logs]
}

export function disabledPlugins(): Set<string> {
  try {
    const raw = localStorage.getItem(DISABLED_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

export function setPluginDisabled(name: string, disabled: boolean): void {
  const set = disabledPlugins()
  if (disabled) set.add(name)
  else set.delete(name)
  localStorage.setItem(DISABLED_KEY, JSON.stringify([...set]))
}

async function handleWorkerCall(
  msg: { id: number; method: string; args: unknown[] },
  worker: ManagedWorker,
): Promise<void> {
  try {
    let result: unknown
    switch (msg.method) {
      case 'getActiveNote': {
        const { tabs, activeTabId } = useTabStore.getState()
        const tab = tabs.find((t) => t.id === activeTabId)
        if (!tab || tab.kind !== 'note' || !tab.notePath) {
          result = null
        } else {
          const doc = useNoteStore.getState().docs[tab.notePath]
          result = doc
            ? { path: doc.path, title: doc.title, content: doc.content }
            : null
        }
        break
      }
      case 'readNote': {
        const [path] = msg.args as [string]
        result = await noteApi.read(path)
        break
      }
      case 'writeNote': {
        const [path, content] = msg.args as [string, string]
        await noteApi.write(path, content)
        result = undefined
        break
      }
      default:
        throw new Error('Unknown method: ' + msg.method)
    }
    try {
      worker.postMessage({ type: 'response', id: msg.id, result })
    } catch (_) {
      // Worker terminated before response could be delivered — safe to discard
    }
  } catch (err) {
    try {
      worker.postMessage({ type: 'response', id: msg.id, error: String(err) })
    } catch (_) {
      // Worker terminated before error response could be delivered — safe to discard
    }
  }
}

/** Runs plugin source inside an isolated Web Worker.
 *  The plugin's `nx` API is a message-passing proxy — no access to
 *  window, document, __TAURI__, or any host globals. */
export function executePlugin(
  source: string,
  pluginName: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const worker = createManagedWorker(WORKER_SOURCE)
    const handle: PluginHandle = { worker, commandIds: [], unsubs: [] }
    let settled = false

    const INIT_TIMEOUT_MS = 5000

    function settle(err: string | null) {
      if (settled) return
      settled = true
      clearTimeout(initTimer)
      if (err) {
        worker.terminate()
      }
      resolve(err)
    }

    const initTimer = setTimeout(() => {
      settle('Plugin init timed out after ' + INIT_TIMEOUT_MS + 'ms')
    }, INIT_TIMEOUT_MS)

    worker.onMessage((data) => {
      const msg = data as WorkerToHostMessage

      switch (msg.type) {
        case 'ready':
          activeWorkers.set(pluginName, handle)
          settle(null)
          break

        case 'error':
          settle(msg.error)
          break

        case 'call':
          handleWorkerCall(msg, worker)
          break

        case 'register': {
          const fullId = `${COMMAND_PREFIX}${pluginName}:${msg.id}`
          if (handle.commandIds.includes(fullId)) break
          handle.commandIds.push(fullId)
          commands.register({
            id: fullId,
            title: msg.title,
            category: `Plugin · ${pluginName}`,
            keywords: [pluginName],
            run: () => {
              worker.postMessage({ type: 'run-command', commandId: msg.id })
            },
          })
          break
        }

        case 'subscribe': {
          const handler: PluginEventHandler = (detail) => {
            worker.postMessage({
              type: 'event-deliver',
              handlerId: msg.handlerId,
              detail,
            })
          }
          handle.unsubs.push(pluginBus.on(msg.event as PluginEventName, handler))
          break
        }

        case 'log':
          logs.push(`[${pluginName}] ${msg.message}`)
          break
      }
    })

    worker.onError((err) => {
      settle(String(err))
    })

    worker.postMessage({ type: 'init', source })
  })
}

function unloadAll(): void {
  for (const [, handle] of activeWorkers) {
    handle.worker.terminate()
    for (const id of handle.commandIds) commands.unregister(id)
    for (const unsub of handle.unsubs) unsub()
  }
  activeWorkers.clear()
  pluginBus.clearAll()
}

/** Terminate a single plugin's Worker and clean up its registrations. */
export function terminatePlugin(name: string): void {
  const handle = activeWorkers.get(name)
  if (!handle) return
  handle.worker.terminate()
  for (const id of handle.commandIds) commands.unregister(id)
  for (const unsub of handle.unsubs) unsub()
  activeWorkers.delete(name)
}

export async function loadPlugins(
  workspacePath: string,
): Promise<PluginStatus[]> {
  unloadAll()
  let infos
  try {
    infos = await pluginApi.list(workspacePath)
  } catch (e) {
    return [{ name: '(list)', enabled: false, error: String(e) }]
  }
  const disabled = disabledPlugins()
  const statuses: PluginStatus[] = []
  for (const info of infos) {
    if (disabled.has(info.name)) {
      statuses.push({ name: info.name, enabled: false, error: null })
      continue
    }
    try {
      const source = await pluginApi.read(workspacePath, info.name)
      const error = await executePlugin(source, info.name)
      if (error) {
        statuses.push({ name: info.name, enabled: true, error })
        continue
      }
      statuses.push({ name: info.name, enabled: true, error: null })
    } catch (e) {
      statuses.push({ name: info.name, enabled: true, error: String(e) })
    }
  }
  return statuses
}
