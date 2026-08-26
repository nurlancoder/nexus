# NEXUS Roadmap

## Principles

- Markdown files are the source of truth; SQLite only stores index/metadata/graph/search/UI state.
- 100% local-first and offline-first. No API keys, no cloud, no telemetry.
- AI is a future *plugin* — never a dependency of the core.
- Build in phases. Never start the next phase before the current one is tested and builds clean.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 0 | Architecture (Tauri 2 + React + TS + Vite + Tailwind + SQLite foundation) | ✅ Done |
| 1 | Desktop Shell (window, sidebar, header, main, inspector, tabs, dark/light) | ✅ Done |
| 2 | Workspace (create/open/recent, folder tree, file explorer, Markdown FS) | ✅ Done |
| 3 | Note Engine (create/open/edit/save/rename/delete/move/duplicate) | ✅ Done |
| 4 | Editor (Tiptap: headings, lists, code, quote, table, checklist, links, slash) | ✅ Done |
| 5 | Markdown Engine (parser, frontmatter, properties, [[links]], tags, embeds) | ✅ Done |
| 6 | Search (index, fuzzy, filters, recent) | ✅ Done |
| 7 | Linking (backlinks, unlinked mentions, aliases, outgoing) | ✅ Done |
| 8 | Graph (global, local, filters, zoom, focus, clusters, analytics) | ✅ Done |
| 9 | Canvas (infinite canvas, nodes, edges, groups, save/load) | ✅ Done |
| 10 | Properties + Databases (properties, tables, filter, sort, views) | ✅ Done |
| 11 | Tasks (checkboxes, task parser, due dates, priorities, projects) | ✅ Done |
| 12 | Projects (dashboard, progress, tasks, notes, resources, timeline) | ✅ Done |
| 13 | Calendar (daily notes, calendar, agenda) | ✅ Done |
| 14 | Attachments (images, PDF, drag/drop, preview) | ✅ Done |
| 15 | Templates (engine, variables, daily/project/research templates) | ✅ Done |
| 16 | Workspace System (layouts, presets, split panes, tabs, focus mode) | ✅ Done |
| 17 | History / Backup (snapshots, restore, version history, crash recovery) | ✅ Done |
| 18 | Knowledge Intelligence (orphans, broken links, duplicates, health — AI-free) | ✅ Done |
| 19 | Plugin Architecture (API, commands, events, extension points) | ✅ Done |
| 20 | Polish (animations, shortcuts, a11y, performance, empty/error states) | ✅ Done |
| 21 | Testing (unit, integration, FS, DB, graph, editor — vitest + cargo test; 132 frontend + 57 Rust) | ✅ Done |
| 22 | Production (installer, portable, auto-updater, icon, signing, docs) | 🔄 In Progress — see notes below |

## MVP target (after Phases 1–8)

Workspace → File Explorer → Markdown Notes → Editor → Internal Links → Backlinks → Search → Basic Graph. Canvas, Databases, Tasks follow after.

## Agent workflow rule

For every phase the agent must: inspect → plan → implement only that phase → test → typecheck → build → fix → report changed files → stop. Do not start the next phase.