use std::sync::Mutex;
use tauri::Manager;

use crate::db::Database;

/// Creates a mock Tauri app with an in-memory SQLite database containing
/// the `workspaces` table. Used across all test modules to avoid duplication.
pub fn mock_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
  let app = tauri::test::mock_app();
  let conn = rusqlite::Connection::open_in_memory().unwrap();
  conn.execute_batch(
    "CREATE TABLE workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_opened_at TEXT
    );
    CREATE TABLE files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      title TEXT,
      type TEXT NOT NULL DEFAULT 'note',
      size INTEGER NOT NULL DEFAULT 0,
      modified_at TEXT,
      indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (workspace_id, path)
    );
    CREATE TABLE note_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      content TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE databases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      definition TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (workspace_id, name)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS note_index USING fts5(
      title, content, path UNINDEXED, workspace_id UNINDEXED
    );",
  )
  .unwrap();
  app.manage(Database(Mutex::new(conn)));
  app.handle().clone()
}

/// Registers a workspace path in the mock database.
pub fn register_ws(app: &tauri::AppHandle<tauri::test::MockRuntime>, path: &str) {
  let db = app.state::<Database>();
  let conn = db.conn();
  conn.execute(
    "INSERT INTO workspaces (name, path) VALUES (?1, ?2)",
    rusqlite::params![
      std::path::Path::new(path)
        .file_name()
        .unwrap()
        .to_str()
        .unwrap(),
      path
    ],
  )
  .unwrap();
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn mock_app_provides_valid_database() {
    let app = mock_app();
    let db = app.state::<Database>();
    let conn = db.conn();
    let count: i64 = conn
      .query_row("SELECT COUNT(*) FROM workspaces", [], |r| r.get(0))
      .unwrap();
    assert_eq!(count, 0);
  }

  #[test]
  fn register_ws_inserts_workspace() {
    let app = mock_app();
    register_ws(&app, "/tmp/test_ws");
    let db = app.state::<Database>();
    let conn = db.conn();
    let count: i64 = conn
      .query_row("SELECT COUNT(*) FROM workspaces", [], |r| r.get(0))
      .unwrap();
    assert_eq!(count, 1);
    let name: String = conn
      .query_row("SELECT name FROM workspaces LIMIT 1", [], |r| r.get(0))
      .unwrap();
    assert_eq!(name, "test_ws");
  }
}
