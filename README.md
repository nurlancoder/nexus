# NEXUS

Local-first, offline-first, AI-free desktop knowledge workspace.

Notes + Knowledge + Projects + Tasks + Graph + Canvas + Databases — all in one Markdown-based workspace. No API keys, no cloud, no telemetry.

## Stack

- **Shell:** Tauri 2 (Rust)
- **UI:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **State:** Zustand
- **Database:** SQLite (rusqlite, bundled)
- **Persistence:** Markdown files (source of truth) + SQLite (index/metadata)

## Development

```bash
npm install          # frontend deps
npm run dev          # vite dev server (browser preview)
npm run tauri:dev    # desktop app with hot reload
npm run build        # typecheck + production build
npm run lint         # oxlint
npm run tauri:build  # production desktop bundle
```

See `docs/RELEASING.md` for installers, portable builds and signed auto-updates.

## Structure

```
src/
  app/         app shell, routes, providers
  components/  ui, layout, editor, graph, canvas, command, dialogs
  features/    notes, backlinks, graph, canvas, tasks, projects, database, ...
  core/        filesystem, database, parser, indexing, graph, events, commands
  stores/      zustand stores (workspace, notes, editor, graph, settings)
  hooks/ lib/ types/ styles/
src-tauri/
  src/         Rust backend (db.rs — SQLite layer)
  migrations/  SQL migrations
```

## Phase roadmap

See `docs/roadmap.md` for the 23-phase build plan. Current phase: **22 — Production** (installer, portable, auto-updater, icon, signing, docs).