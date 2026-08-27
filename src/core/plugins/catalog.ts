export interface CatalogPlugin {
  id: string
  title: string
  author: string
  version: string
  description: string
  source: string
}

/** File a catalog plugin is installed under, e.g. `date-stamp.js`. */
export function catalogFileName(id: string): string {
  return `${id}.js`
}

/** Plugins offered in the built-in marketplace (curated, offline sample set).
 *  Install copies `source` into <vault>/plugins/ as `<id>.js`. */
export const MARKETPLACE_PLUGINS: readonly CatalogPlugin[] = [
  {
    id: 'date-stamp',
    title: 'Date Stamp',
    author: 'Nexus',
    version: '1.0.0',
    description:
      'Add a command that inserts today’s date line under the first heading of the active note.',
    source: `// Date Stamp plugin (from the Nexus marketplace).
// nx.registerCommand adds a command-palette entry.
nx.registerCommand({
  id: 'insert-date',
  title: 'Sample: insert today below the first heading',
  run: function () {
    var note = nx.getActiveNote()
    if (!note || !note.content) return
    var updated = note.content.replace(
      /^(# .*\\n)/,
      '$1\\n' + nx.today() + '\\n'
    )
    if (updated !== note.content) {
      nx.writeNote(note.path, updated)
      nx.log('Inserted date into ' + note.path)
    }
  },
})
`,
  },
  {
    id: 'word-count',
    title: 'Word Count',
    author: 'Nexus',
    version: '1.0.0',
    description:
      'Logs the word count of the active note to the plugin console every time a note opens.',
    source: `// Word Count plugin (from the Nexus marketplace).
// nx.on subscribes to note lifecycle events raised by the host.
nx.on('note:open', function (note) {
  var body = (note.content || '')
  var words = body.trim().split(/\\s+/).filter(Boolean).length
  nx.log('word-count of ' + note.title + ': ' + words)
})
`,
  },
  {
    id: 'todo-counter',
    title: 'Todo Counter',
    author: 'Nexus',
    version: '1.0.0',
    description:
      'Registers a keybinding (Ctrl+Shift+D) that counts open todo items in the active note.',
    source: `// Todo Counter plugin (from the Nexus marketplace).
// nx.registerCommand exposes a runnable command; nx.registerKeybinding
// binds it to a chord. The counter is logged to the plugin console.
nx.registerCommand({
  id: 'count-todos',
  title: 'Todo Counter: count open items in current note',
  run: function () {
    var note = nx.getActiveNote()
    if (!note || !note.content) return
    var open = 0
    var done = 0
    note.content.split(/\\n/).forEach(function (line) {
      if (/^-\\s*\\[ \\]/.test(line)) open++
      if (/^-\\s*\\[x\\]/.test(line)) done++
    })
    nx.log(note.title + ' → open: ' + open + ', done: ' + done)
  },
})
nx.registerKeybinding(
  { id: 'count-todos-kb', key: 'd', mod: true, shift: true },
  'count-todos'
)
`,
  },
]

export function isCatalogInstalled(
  statusNames: readonly string[],
  id: string,
): boolean {
  return statusNames.includes(catalogFileName(id))
}
