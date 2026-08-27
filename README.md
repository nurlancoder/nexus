# NEXUS

**Local-first, offline-first, AI-free desktop knowledge workspace.**

Notes + Knowledge + Projects + Tasks + Graph + Canvas + Databases — all in one Markdown-based workspace. No API keys, no cloud, no telemetry.

---

## Features

- **Markdown Notes** — Rich-text editor with frontmatter, wiki links, task checkboxes
- **Knowledge Graph** — Visualize connections between notes
- **Canvas** — Infinite whiteboard for diagrams and mind maps
- **Databases** — Table views over your notes with filtering and sorting
- **Tasks** — Scan all `- [ ]` checkboxes across the workspace
- **Projects** — Group related notes into project folders
- **Calendar** — Daily note integration
- **Templates** — Reusable note templates
- **Search** — Full-text search across all notes (FTS5)
- **Attachments** — File and media support
- **Plugins** — Extend with custom JavaScript plugins (sandboxed in Web Workers)
- **Command Palette** — Quick access to everything (Ctrl+K)
- **Dark/Light Theme** — Automatic system theme detection

## Principles

- **Markdown is source of truth** — SQLite only stores index/metadata
- **No cloud dependency** — Works fully offline
- **No telemetry** — Zero network requests to external servers
- **No AI** — Pure tool, no AI features or API calls
- **Local-first** — All data lives on your filesystem

## Stack

| Layer | Technology |
|-------|-----------|
| Shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Editor | Tiptap (ProseMirror) |
| Database | SQLite (rusqlite, bundled) |
| Search | SQLite FTS5 |

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Rust** 1.85+ (install via [rustup](https://rustup.rs/), not distro packages)

### Development

```bash
git clone https://github.com/nexus-app/nexus.git
cd nexus
npm install              # frontend deps
npm run tauri:dev        # desktop app with hot reload
```

### Other Commands

```bash
npm run dev              # vite dev server (browser preview)
npm run build            # typecheck + production build
npm run lint             # oxlint
npm run test             # vitest (frontend)
npm run tauri:build      # production desktop bundle
```

### Rust Backend

```bash
cd src-tauri
cargo test --lib         # 106 tests
cargo clippy             # 0 warnings
cargo audit              # dependency audit
```

## Project Structure

```
src/
  app/           App shell, routes, providers
  components/    ui/, layout/, editor/, graph/, canvas/, command/, ...
  features/      notes/, workspace/
  core/          filesystem/, database/, parser/, graph/, commands/, plugins/
  stores/        zustand stores (workspace, tabs, notes, tasks, ...)
  lib/           utilities (paths, tree, styles, storeUtils)
  types/         shared TypeScript types
src-tauri/
  src/           Rust backend (db, workspace, tasks, graph, ...)
  migrations/    SQL schema (001_init.sql)
public/
  plugin-worker.js   Plugin sandbox Web Worker
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  Tauri 2 Shell (Rust)                       │
│  ├── SQLite (index, metadata, FTS5)         │
│  ├── Markdown files (source of truth)       │
│  └── Path validation + security layer       │
├─────────────────────────────────────────────┤
│  Frontend (React 19 + TypeScript)           │
│  ├── Zustand stores (state management)      │
│  ├── Tiptap editor (ProseMirror)            │
│  ├── Plugin sandbox (Web Workers)           │
│  └── Code-split bundles (lazy-loaded views) │
└─────────────────────────────────────────────┘
```

## Plugin System

Plugins are JavaScript files placed in `<workspace>/plugins/`. They run sandboxed in Web Workers with:

- No access to DOM, `window`, or `document`
- No access to Tauri IPC or `__TAURI__`
- No access to `localStorage`
- Strict message-passing API (`nx.readNote`, `nx.writeNote`, `nx.log`, etc.)
- 5-second init timeout
- Capped log buffer (5,000 entries FIFO)
- Force-terminate from UI

## Quality

| Check | Status |
|-------|--------|
| TypeScript | Clean (`tsc -b`) |
| Frontend tests | 159/159 passing |
| Rust tests | 106/106 passing |
| Clippy | 0 warnings |
| Lint | oxlint clean |
| Bundle | 71.6KB index + code-split chunks |
| Accessibility | ARIA roles, labels, keyboard navigation |

## Documentation

- `docs/audit-2026-08-26.md` — Full code audit report (Phases A-E)
- `docs/RELEASING.md` — Installer, portable builds, signed auto-updates
- `docs/roadmap.md` — 23-phase build plan

## License

MIT
