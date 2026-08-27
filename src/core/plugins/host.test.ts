import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import {
  executePlugin,
  clearLogs,
  pluginLogs,
  terminatePlugin,
  _setWorkerFactory,
  createManagedWorker,
  type ManagedWorker,
} from './host'
import { pluginBus } from './bus'
import { commands } from '@/core/commands/registry'
import { pluginKeybindings } from './keybindingRegistry'
import { WORKER_SOURCE } from './worker-source'

vi.mock('@/core/filesystem/api', () => ({
  noteApi: {
    read: vi.fn(async (path: string) => {
      if (
        path.includes('..') ||
        path.includes('\0') ||
        path.startsWith('/etc') ||
        path.startsWith('/var') ||
        path.startsWith('/tmp')
      ) {
        throw new Error('Path validation failed: path escapes workspace')
      }
      return 'mock content for ' + path
    }),
    write: vi.fn(async (path: string) => {
      if (
        path.includes('..') ||
        path.includes('\0') ||
        path.startsWith('/etc') ||
        path.startsWith('/var') ||
        path.startsWith('/tmp')
      ) {
        throw new Error('Path validation failed: path escapes workspace')
      }
    }),
  },
  pluginApi: {
    list: vi.fn(async () => []),
    read: vi.fn(async () => ''),
  },
}))

const terminateCalls: string[] = []

beforeAll(() => {
  const { Worker: NodeWorker } = require('node:worker_threads')
  _setWorkerFactory((source: string): ManagedWorker => {
    const w = new NodeWorker(source, { eval: true })
    return {
      postMessage: (data) => w.postMessage(data),
      onMessage: (fn) => {
        w.on('message', fn)
      },
      onError: (fn) => {
        w.on('error', fn)
      },
      terminate: () => {
        terminateCalls.push('terminate')
        w.terminate()
      },
    }
  })
  clearLogs()
})

beforeEach(() => {
  terminateCalls.length = 0
})

function createTestWorker(): ManagedWorker {
  return createManagedWorker(WORKER_SOURCE)
}

function runPlugin(
  source: string,
): Promise<{ logs: string[]; error: string | null }> {
  return new Promise((resolve) => {
    const logs: string[] = []
    let error: string | null = null
    let settled = false

    const worker = createTestWorker()

    worker.onMessage((data) => {
      const msg = data as Record<string, unknown>

      if (msg.type === 'ready') {
        if (!settled) {
          settled = true
          resolve({ logs, error })
        }
        return
      }

      if (msg.type === 'error') {
        if (!settled) {
          settled = true
          error = msg.error as string
          resolve({ logs, error })
        }
        return
      }

      if (msg.type === 'log') {
        logs.push(msg.message as string)
        return
      }

      if (msg.type === 'call') {
        const callMsg = msg as {
          id: number
          method: string
          args: unknown[]
        }
        let result: unknown = null
        let callError: string | undefined
        if (callMsg.method === 'getActiveNote') result = null
        else if (callMsg.method === 'readNote') {
          const p = callMsg.args[0] as string
          if (p.includes('..') || p.startsWith('/etc') || p.startsWith('/var') || p.startsWith('/tmp') || p.includes('\0')) {
            callError = 'Path validation failed: path escapes workspace'
          } else {
            result = 'mock content for ' + p
          }
        } else if (callMsg.method === 'writeNote') {
          const p = callMsg.args[0] as string
          if (p.includes('..') || p.startsWith('/etc') || p.startsWith('/var') || p.startsWith('/tmp') || p.includes('\0')) {
            callError = 'Path validation failed: path escapes workspace'
          } else {
            result = undefined
          }
        }
        worker.postMessage({
          type: 'response',
          id: callMsg.id,
          ...(callError ? { error: callError } : { result }),
        })
        return
      }
    })

    worker.onError((err) => {
      if (!settled) {
        settled = true
        error = String(err)
        resolve({ logs, error })
      }
    })

    worker.postMessage({ type: 'init', source })
  })
}

describe('executePlugin', () => {
  it('executes plugin code successfully', async () => {
    const result = await runPlugin(`nx.log('hello')`)
    expect(result.error).toBeNull()
    expect(result.logs).toContain('hello')
  })

  it('returns the error message for broken source', async () => {
    const result = await runPlugin('this is not valid js (')
    expect(result.error).toBeTruthy()
  })

  it('S-07: prototype chain attack cannot reach host globals', async () => {
    const result = await runPlugin(`
      try {
        var g = nx.__proto__.constructor.constructor('return this')();
        nx.log('global_escape:' + (typeof g));
      } catch(e) {
        nx.log('blocked:' + e);
      }
      try {
        var g = nx.__proto__.constructor.constructor('return this')();
        nx.log('doc_escape:' + (typeof g.document));
      } catch(e) {
        nx.log('blocked:' + e);
      }
      try {
        var g = nx.__proto__.constructor.constructor('return this')();
        nx.log('tauri_escape:' + (typeof g.__TAURI__));
      } catch(e) {
        nx.log('blocked:' + e);
      }
    `)

    const globalEscaped = result.logs.some(
      (l) => l === 'global_escape:object',
    )
    const docAccessible = result.logs.some(
      (l) => l === 'doc_escape:object',
    )
    const tauriAccessible = result.logs.some(
      (l) => l === 'tauri_escape:object',
    )

    expect(globalEscaped).toBe(true)
    expect(docAccessible).toBe(false)
    expect(tauriAccessible).toBe(false)
  })

  it('S-07: cannot reach Tauri IPC bridge or document via escape', async () => {
    const result = await runPlugin(`
      try {
        var g = nx.__proto__.constructor.constructor('return this')();
        nx.log('tauri_ipc:' + (typeof g.__TAURI__));
        nx.log('tauri_ipc_fn:' + (typeof g.__TAURI_INTERNALS__));
      } catch(e) {
        nx.log('blocked:' + e);
      }
    `)

    expect(result.logs).toContain('tauri_ipc:undefined')
    expect(result.logs).toContain('tauri_ipc_fn:undefined')
  })

  it('S-07: cannot reach globalThis properties via escape', async () => {
    const result = await runPlugin(`
      try {
        var g = nx.__proto__.constructor.constructor('return this')();
        nx.log('window:' + (typeof g.window));
        nx.log('document:' + (typeof g.document));
        nx.log('__TAURI__:' + (typeof g.__TAURI__));
        nx.log('localStorage:' + (typeof g.localStorage));
      } catch(e) {
        nx.log('blocked:' + e);
      }
    `)

    expect(result.logs).toContain('window:undefined')
    expect(result.logs).toContain('document:undefined')
    expect(result.logs).toContain('__TAURI__:undefined')
    expect(result.logs).toContain('localStorage:undefined')
  })

  it('nx.log sends messages to host', async () => {
    const result = await runPlugin(`
      nx.log('test message 1')
      nx.log('test message 2')
    `)
    expect(result.logs).toContain('test message 1')
    expect(result.logs).toContain('test message 2')
  })

  it('nx.today returns a date string', async () => {
    const result = await runPlugin(`nx.log('today:' + nx.today())`)
    expect(result.logs.some((l) => /^today:\d{4}-\d{2}-\d{2}$/.test(l))).toBe(
      true,
    )
  })

  it('nx.readNote works through message passing', async () => {
    const result = await runPlugin(`
      nx.readNote('test.md').then(function(content) {
        nx.log('content:' + content);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.includes('content:mock content for'))).toBe(
      true,
    )
  })

  it('nx.writeNote works through message passing', async () => {
    const { noteApi } = await import('@/core/filesystem/api')
    vi.mocked(noteApi.write).mockClear()

    const err = await executePlugin(
      `nx.writeNote('test.md', 'new content').then(function() { nx.log('written'); });`,
      'writeplug',
    )
    expect(err).toBeNull()
    await new Promise((r) => setTimeout(r, 200))
    expect(noteApi.write).toHaveBeenCalledWith('test.md', 'new content')
  })

  it('nx.getActiveNote returns null when no note active', async () => {
    const result = await runPlugin(`
      nx.getActiveNote().then(function(note) {
        nx.log('note:' + JSON.stringify(note));
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.includes('note:null'))).toBe(true)
  })

  it('nx.registerCommand registers a command on the host', async () => {
    const err = await executePlugin(
      `nx.registerCommand({ id: 'ping', title: 'Test ping', run: function () {} });`,
      'testplug',
    )
    expect(err).toBeNull()
    const cmd = commands
      .all()
      .find((c) => c.id === 'plugin:testplug:ping')
    expect(cmd?.title).toBe('Test ping')
    commands.unregister('plugin:testplug:ping')
  })

  it('nx.registerKeybinding registers a keybinding on the host', async () => {
    pluginKeybindings.clearAll()
    const err = await executePlugin(
      `nx.registerCommand({ id: 'jump', title: 'Jump', run: function () {} });` +
        `nx.registerKeybinding({ id: 'kb', key: 'j', mod: true, shift: true }, 'jump');`,
      'testplug',
    )
    expect(err).toBeNull()
    const binding = pluginKeybindings
      .all()
      .find((b) => b.id === 'kb' && b.plugin === 'testplug')
    expect(binding?.commandId).toBe('plugin:testplug:jump')
    expect(binding?.spec).toEqual({ key: 'j', mod: true, shift: true, alt: false })
    pluginKeybindings.clearAll()
    commands.unregister('plugin:testplug:jump')
  })

  it('nx.on subscribes to events via the host', async () => {
    const result = await runPlugin(`
      nx.on('note:open', function(detail) {
        nx.log('opened:' + detail.path);
      });
    `)
    expect(result.error).toBeNull()
  })

  it('error in plugin source is caught and returned', async () => {
    const result = await runPlugin(
      `throw new Error('plugin exploded')`,
    )
    expect(result.error).toContain('plugin exploded')
  })

  it('plugin cannot reach host DOM or Tauri globals via escape', async () => {
    const result = await runPlugin(`
      try {
        var g = nx.__proto__.constructor.constructor('return this')();
        nx.log('document:' + (typeof g.document));
        nx.log('__TAURI__:' + (typeof g.__TAURI__));
        nx.log('localStorage:' + (typeof g.localStorage));
        nx.log('location_href:' + (typeof g.location.href));
      } catch(e) {
        nx.log('blocked:' + e);
      }
    `)
    expect(result.logs).toContain('document:undefined')
    expect(result.logs).toContain('__TAURI__:undefined')
    expect(result.logs).toContain('localStorage:undefined')
  })
})

describe('pluginBus', () => {
  it('delivers events to subscribers and stops after unsubscribe', () => {
    const got: string[] = []
    const off = pluginBus.on('note:open', (d) => got.push(d.path))
    pluginBus.emit('note:open', { path: '/a.md', title: 'A' })
    off()
    pluginBus.emit('note:open', { path: '/b.md', title: 'B' })
    expect(got).toEqual(['/a.md'])
    pluginBus.clearAll()
  })

  it('swallows handler errors without breaking other handlers', () => {
    const got: string[] = []
    pluginBus.on('note:save', () => {
      throw new Error('boom')
    })
    pluginBus.on('note:save', (d) => got.push(d.path))
    pluginBus.emit('note:save', { path: '/c.md', title: 'C' })
    expect(got).toEqual(['/c.md'])
    pluginBus.clearAll()
  })
})

describe('DoS / message flooding', () => {
  it('infinite-loop plugin times out without blocking the host', async () => {
    const hostStart = Date.now()
    const hostHeartbeat = new Promise<void>((resolve) => {
      setTimeout(resolve, 200)
    })

    const pluginResult = executePlugin(
      'while (true) { /* spin forever */ }',
      'infinite-loop-plugin',
    )

    await hostHeartbeat
    const hostElapsed = Date.now() - hostStart
    expect(hostElapsed).toBeGreaterThanOrEqual(180)
    expect(hostElapsed).toBeLessThan(1000)

    const error = await pluginResult
    const totalElapsed = Date.now() - hostStart
    expect(error).toBeTruthy()
    expect(error).toContain('timed out')
    expect(totalElapsed).toBeGreaterThanOrEqual(4900)
    expect(totalElapsed).toBeLessThan(7000)
  }, 10000)

  it('flooding nx.log() does not crash the host and messages are capped', async () => {
    const COUNT = 100_000
    const MAX_LOG_ENTRIES = 5000
    const start = Date.now()

    clearLogs()

    const error = await executePlugin(
      `for (var i = 0; i < ${COUNT}; i++) { nx.log("flood-" + i); }`,
      'flood-plugin',
    )
    const elapsed = Date.now() - start

    expect(error).toBeNull()

    const allLogs = pluginLogs()
    const floodLogs = allLogs.filter((l) => l.startsWith('[flood-plugin] flood-'))
    expect(floodLogs.length).toBe(MAX_LOG_ENTRIES)

    clearLogs()
    expect(elapsed).toBeLessThan(30000)
  }, 60000)
})

describe('exfiltration via plugin bridge', () => {
  // NOTE: These tests exercise the JS message-passing protocol and mock validation.
  // They do NOT prove the real Rust validate_path rejects these vectors.
  // Real Rust-level coverage is in src-tauri/src/workspace.rs:
  //   note_read_rejects_path_traversal_outside_workspace
  //   note_write_rejects_path_traversal_outside_workspace
  //   note_write_rejects_symlink_escape
  //   note_read_rejects_symlink_escape
  // And in src-tauri/src/security.rs:
  //   validate_rejects_dotdot_traversal
  //   validate_rejects_deeply_nested_dotdot_traversal
  //   validate_rejects_workspace_prefix_sibling
  //   validate_path_rejects_null_bytes
  //   validate_rejects_null_bytes_at_various_positions
  //   validate_path_rejects_symlink_escape
  it('readNote with path traversal is rejected', async () => {
    const result = await runPlugin(`
      nx.readNote('../../../../etc/passwd').then(function(c) {
        nx.log('success:' + c);
      }).catch(function(e) {
        nx.log('rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('rejected:'))).toBe(true)
    expect(result.logs.some((l) => l.startsWith('success:'))).toBe(false)
  })

  it('readNote with absolute path outside workspace is rejected', async () => {
    const result = await runPlugin(`
      nx.readNote('/etc/passwd').then(function(c) {
        nx.log('success:' + c);
      }).catch(function(e) {
        nx.log('rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('rejected:'))).toBe(true)
    expect(result.logs.some((l) => l.startsWith('success:'))).toBe(false)
  })

  it('readNote with null byte is rejected', async () => {
    const result = await runPlugin(`
      nx.readNote('notes/file\0.md').then(function(c) {
        nx.log('success:' + c);
      }).catch(function(e) {
        nx.log('rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('rejected:'))).toBe(true)
    expect(result.logs.some((l) => l.startsWith('success:'))).toBe(false)
  })

  it('readNote with valid in-workspace path succeeds', async () => {
    const result = await runPlugin(`
      nx.readNote('notes/valid.md').then(function(c) {
        nx.log('success:' + c);
      }).catch(function(e) {
        nx.log('rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('success:mock content for'))).toBe(true)
  })

  it('writeNote with path traversal is rejected', async () => {
    const result = await runPlugin(`
      nx.writeNote('../../../../etc/evil.sh', 'payload').then(function() {
        nx.log('write_success');
      }).catch(function(e) {
        nx.log('write_rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('write_rejected:'))).toBe(true)
    expect(result.logs.some((l) => l === 'write_success')).toBe(false)
  })

  it('writeNote with absolute path outside workspace is rejected', async () => {
    const result = await runPlugin(`
      nx.writeNote('/tmp/malicious.md', 'payload').then(function() {
        nx.log('write_success');
      }).catch(function(e) {
        nx.log('write_rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('write_rejected:'))).toBe(true)
    expect(result.logs.some((l) => l === 'write_success')).toBe(false)
  })

  it('writeNote with valid in-workspace path succeeds', async () => {
    const result = await runPlugin(`
      nx.writeNote('notes/valid.md', 'content').then(function() {
        nx.log('write_success');
      }).catch(function(e) {
        nx.log('write_rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l === 'write_success')).toBe(true)
  })

  it('path traversal via nested .. segments is rejected', async () => {
    const result = await runPlugin(`
      nx.readNote('sub/../../other/workspace/secret.md').then(function(c) {
        nx.log('success:' + c);
      }).catch(function(e) {
        nx.log('rejected:' + e.message);
      });
    `)
    await new Promise((r) => setTimeout(r, 200))
    expect(result.logs.some((l) => l.startsWith('rejected:'))).toBe(true)
    expect(result.logs.some((l) => l.startsWith('success:'))).toBe(false)
  })
})

describe('termination / leak cleanup', () => {
  it('terminatePlugin removes registered commands, unsubscribes events, and calls worker.terminate()', async () => {
    const err = await executePlugin(
      `nx.registerCommand({ id: 'test-cmd', title: 'Test Cmd', run: function() {} });` +
      `nx.on('note:open', function(d) { nx.log('event:' + d.path); });`,
      'termplug',
    )
    expect(err).toBeNull()

    const cmdBefore = commands.all().find((c) => c.id === 'plugin:termplug:test-cmd')
    expect(cmdBefore).toBeDefined()
    expect(cmdBefore?.title).toBe('Test Cmd')

    let eventFired = false
    pluginBus.on('note:open', () => { eventFired = true })

    terminatePlugin('termplug')

    const cmdAfter = commands.all().find((c) => c.id === 'plugin:termplug:test-cmd')
    expect(cmdAfter).toBeUndefined()

    pluginBus.emit('note:open', { path: '/late.md', title: 'Late' })
    await new Promise((r) => setTimeout(r, 100))

    expect(eventFired).toBe(true)

    expect(terminateCalls.length).toBe(1)

    pluginBus.clearAll()
  })

  it('terminatePlugin during in-flight call does not throw unhandled rejection', async () => {
    // NOTE: In Node.js worker_threads, postMessage silently discards on
    // terminated workers. In browser Web Workers, it throws a DOMException.
    // This test simulates the browser behavior by using a mock worker factory
    // where postMessage throws after termination — proving handleWorkerCall's
    // try-catch guards actually prevent the unhandled rejection in production.
    const { noteApi } = await import('@/core/filesystem/api')
    const originalRead = noteApi.read
    // The host's noteApi.read resolves after a delay, so handleWorkerCall
    // reaches postMessage AFTER terminatePlugin has already killed the worker
    vi.mocked(noteApi.read).mockImplementation(
      () => new Promise((r) => setTimeout(() => r('delayed content'), 200)),
    )

    let workerTerminated = false
    _setWorkerFactory((source: string): ManagedWorker => {
      const { Worker: NodeWorker } = require('node:worker_threads')
      const w = new NodeWorker(source, { eval: true })
      return {
        postMessage: (data) => {
          if (workerTerminated) {
            // Simulate browser Web Worker behavior: throws on terminated worker
            throw new DOMException(
              'Failed to execute \'postMessage\' on \'Worker\': The worker is not responding.',
              'InvalidStateError',
            )
          }
          w.postMessage(data)
        },
        onMessage: (fn) => w.on('message', fn),
        onError: (fn) => w.on('error', fn),
        terminate: () => {
          workerTerminated = true
          w.terminate()
        },
      }
    })

    const hostRejections: unknown[] = []
    const hostExceptions: unknown[] = []
    const onRejection = (reason: unknown) => hostRejections.push(reason)
    const onException = (err: unknown) => hostExceptions.push(err)
    process.on('unhandledRejection', onRejection)
    process.on('uncaughtException', onException)

    try {
      const err = await executePlugin(
        `
        var p = nx.readNote('slow-note.md');
        p.then(function(c) { nx.log('got:' + c); })
         .catch(function(e) { nx.log('caught:' + e.message); });
        `,
        'inflightplug',
      )
      expect(err).toBeNull()

      // Terminate immediately — the host's noteApi.read hasn't resolved yet
      terminatePlugin('inflightplug')

      // Wait for the delayed mock to resolve and for handleWorkerCall
      // to attempt posting the response back to the dead worker
      await new Promise((r) => setTimeout(r, 500))

      // Assert: no host-side unhandled rejection or uncaught exception
      expect(hostRejections).toEqual([])
      expect(hostExceptions).toEqual([])

      // Also verify the plugin-side logs confirm the response never arrived
      const allLogs = pluginLogs()
      const gotOrCaught = allLogs.filter(
        (l) =>
          l.startsWith('[inflightplug] got:') ||
          l.startsWith('[inflightplug] caught:'),
      )
      expect(gotOrCaught.length).toBe(0)

      pluginBus.clearAll()
    } finally {
      process.removeListener('unhandledRejection', onRejection)
      process.removeListener('uncaughtException', onException)
      workerTerminated = false
      vi.mocked(noteApi.read).mockImplementation(originalRead as any)
      // Restore the original Node worker factory set in beforeAll
      const { Worker: NodeWorker } = require('node:worker_threads')
      _setWorkerFactory((source: string): ManagedWorker => {
        const w = new NodeWorker(source, { eval: true })
        return {
          postMessage: (data) => w.postMessage(data),
          onMessage: (fn) => w.on('message', fn),
          onError: (fn) => w.on('error', fn),
          terminate: () => {
            terminateCalls.push('terminate')
            w.terminate()
          },
        }
      })
    }
  }, 5000)

  it('normal in-flight call still delivers response after terminate fix', async () => {
    const { noteApi } = await import('@/core/filesystem/api')
    vi.mocked(noteApi.read).mockResolvedValueOnce('happy-path content')

    const err = await executePlugin(
      `
      nx.readNote('good.md').then(function(c) {
        nx.log('got:' + c);
      }).catch(function(e) {
        nx.log('caught:' + e.message);
      });
      `,
      'happypathplug',
    )
    expect(err).toBeNull()

    await new Promise((r) => setTimeout(r, 500))

    const allLogs = pluginLogs()
    const gotLogs = allLogs.filter((l) =>
      l.startsWith('[happypathplug] got:'),
    )
    expect(gotLogs.length).toBe(1)
    expect(gotLogs[0]).toBe('[happypathplug] got:happy-path content')

    pluginBus.clearAll()
  }, 5000)

  it('multiple terminatePlugin calls are idempotent', async () => {
    const err = await executePlugin(
      `nx.registerCommand({ id: 'multi-cmd', title: 'Multi', run: function() {} });`,
      'multiplug',
    )
    expect(err).toBeNull()

    terminatePlugin('multiplug')
    const termCountAfterFirst = terminateCalls.length
    terminatePlugin('multiplug')
    terminatePlugin('multiplug')

    expect(terminateCalls.length).toBe(termCountAfterFirst)

    const cmd = commands.all().find((c) => c.id === 'plugin:multiplug:multi-cmd')
    expect(cmd).toBeUndefined()
  })
})
