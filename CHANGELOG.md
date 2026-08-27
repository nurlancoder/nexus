# Changelog

All notable changes to NEXUS are documented here.

## [0.1.0] — 2026-08-26

### Deep Clean + Maximum Polish Pass (Phases A–E)

This release consolidates, hardens, and polishes the entire codebase across 6 phases.

#### Phase A — Code Audit
- Full codebase audit identifying 0 Critical, 7 High, 8 Medium, 6 Low issues
- Security posture validated: path validation, parameterized SQL, sandbox isolation
- Audit report written to `docs/audit-2026-08-26.md`

#### Phase B — Rust Backend Deepening
- **Consolidated `body_after_frontmatter`**: 3 copies → 1 in `util.rs`
- **Consolidated `find_workspace_id`**: 5+ implementations → 1 canonical + `resolve_workspace_id` shorthand
- **Extracted test helpers**: Shared `mock_app()` + `register_ws()` in `test_helpers.rs`
- **Consolidated file extension checks**: 7+ inline patterns → `is_text_file()` / `is_note()` utilities
- **Standardized workspace validation**: All Tauri commands use `resolve_workspace_id`
- **Fixed migration duplication**: `db.rs` now uses `include_str!` from `migrations/001_init.sql`
- **Added 15 edge-case tests**: Unicode/Azerbaijani characters, empty workspace, corrupt frontmatter
- **Result**: 91 → 106 Rust tests (+16%)

#### Phase C — Frontend Performance + Accessibility
- **Fixed FileExplorer re-render storm** (H5): TreeItem no longer subscribes to tab store; active path computed once in parent
- **Fixed TabBar full-store subscription** (H6): Individual selectors replace destructured store
- **Fixed accessibility gaps** (H7):
  - Dialog: `role="dialog"`, `aria-modal`, focus trap, auto-focus
  - CommandPalette: `role="combobox"`, `aria-activedescendant`, `role="listbox"`, `role="option"`
  - Resizer: `role="separator"`, keyboard support (Arrow ±10px, Shift+Arrow ±50px)
  - ShortcutsHelp: `role="dialog"`, `aria-modal`
- **Extracted `collectDirs`** to shared `lib/tree.ts` (M2)
- **Lazy-loaded 5 secondary views**: Search, Tasks, Projects, Calendar, Templates (M8)
  - `index.js` bundle: 115KB → 86KB (-25%)
- **Created shared style constants**: `lib/styles.ts` (M3)
- **Deduplicated store boilerplate**: `createWorkspaceLoader` helper for taskStore, attachmentStore, projectStore (M1)

#### Phase D — Visual Polish + Accessibility
- **Added aria-labels to 17 icon-only buttons** (L6): Inspector, MainArea, ShortcutsHelp, DatabaseView, AttachmentsView, ProjectsView, TasksView
- **Created `EmptyStatePanel` component**: Consistent empty states across Tasks, Plugins, Templates views

#### Phase E — Plugins + Bundle Optimization
- **Lazy-loaded NoteView**: Removed 512KB tiptap chunk from initial load
  - `index.js`: 86KB → 71.6KB (-17%)
- **Tiered chunk splitting**: vendor-tiptap split into 4 tiers (prosemirror 252KB, tiptap 189KB, markdown 60KB, tables 12KB)
- **Plugin sandbox hardening**:
  - Log buffer capped at 5,000 entries (FIFO, was unbounded)
  - Force-terminate button for stuck plugins
  - `terminate()` action added to plugin store

### Bundle Size Summary

| Chunk | Before | After |
|-------|--------|-------|
| `index.js` | 115 KB | **71.6 KB** (-38%) |
| `vendor-tiptap` | 512 KB (single) | Split: 252 + 189 + 60 + 12 KB |
| `NoteView` | Eager (in index) | Lazy (15.6 KB separate chunk) |
| Total initial load | ~630 KB | **~320 KB** (-49%) |

### Test Coverage

| Suite | Before | After |
|-------|--------|-------|
| Frontend (vitest) | 159 tests | 159 tests |
| Rust (cargo test) | 91 tests | **106 tests** (+16%) |
| Total | 250 tests | **265 tests** |
