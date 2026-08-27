use rusqlite::params;
use serde::Serialize;
use tauri::Manager;

use crate::db::Database;
use crate::security;

pub const MAX_VERSIONS_PER_NOTE: i64 = 50;
const SNAPSHOT_MIN_INTERVAL_SECS: f64 = 300.0;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
  pub id: i64,
  pub created_at: String,
  pub size: i64,
}

fn insert_version(
  conn: &rusqlite::Connection,
  workspace_id: i64,
  path: &str,
  content: &str,
) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO note_versions (workspace_id, path, content, size)
       VALUES (?1, ?2, ?3, ?4)",
      params![workspace_id, path, content, content.len() as i64],
    )
    .map_err(|e| e.to_string())?;
  prune_versions(conn, workspace_id, path, MAX_VERSIONS_PER_NOTE);
  Ok(())
}

fn find_workspace_for_note(conn: &rusqlite::Connection, path: &str) -> Result<i64, String> {
  crate::util::resolve_workspace_id(conn, path)
}

/// Snapshot on save, throttled: only when the newest version differs from the
/// new content AND is older than SNAPSHOT_MIN_INTERVAL_SECS (or none exists).
pub fn maybe_snapshot<R: tauri::Runtime>(app: &tauri::AppHandle<R>, path: &str, content: &str) {
  let Some(db) = app.try_state::<Database>() else { return };
  let conn = db.conn();
  let Ok(workspace_id) = find_workspace_for_note(&conn, path) else {
    return;
  };

  let latest: Option<(String, f64)> = conn
    .query_row(
      "SELECT content, (julianday('now') - julianday(created_at)) * 86400.0
       FROM note_versions
       WHERE workspace_id = ?1 AND path = ?2
       ORDER BY id DESC LIMIT 1",
      params![workspace_id, path],
      |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .ok();

  let should_snapshot = match latest {
    None => true,
    Some((old_content, age_secs)) => {
      old_content != content && age_secs >= SNAPSHOT_MIN_INTERVAL_SECS
    }
  };
  if !should_snapshot {
    return;
  }
  let _ = insert_version(&conn, workspace_id, path, content);
}

/// Unconditional snapshot used before destructive operations (restore).
pub fn force_snapshot<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  path: &str,
  content: &str,
) -> Result<(), String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let workspace_id = find_workspace_for_note(&conn, path)?;
  insert_version(&conn, workspace_id, path, content)
}

fn fetch_version_content(conn: &rusqlite::Connection, id: i64) -> Result<String, String> {
  conn
    .query_row(
      "SELECT content FROM note_versions WHERE id = ?1",
      params![id],
      |r| r.get(0),
    )
    .map_err(|_| format!("Version not found: {}", id))
}

pub fn list_versions(conn: &rusqlite::Connection, path: &str) -> Result<Vec<VersionInfo>, String> {
  let Ok(workspace_id) = find_workspace_for_note(conn, path) else {
    return Ok(Vec::new());
  };
  let mut stmt = conn
    .prepare(
      "SELECT id, created_at, size FROM note_versions
       WHERE workspace_id = ?1 AND path = ?2
       ORDER BY id DESC LIMIT 100",
    )
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map(params![workspace_id, path], |r| {
      Ok(VersionInfo {
        id: r.get(0)?,
        created_at: r.get(1)?,
        size: r.get(2)?,
      })
    })
    .map_err(|e| e.to_string())?;
  let mut out = Vec::new();
  for row in rows {
    out.push(row.map_err(|e| e.to_string())?);
  }
  Ok(out)
}

pub fn prune_versions(
  conn: &rusqlite::Connection,
  workspace_id: i64,
  path: &str,
  keep: i64,
) -> usize {
  conn
    .execute(
      "DELETE FROM note_versions
       WHERE workspace_id = ?1 AND path = ?2 AND id NOT IN (
         SELECT id FROM note_versions
         WHERE workspace_id = ?1 AND path = ?2
         ORDER BY id DESC LIMIT ?3
       )",
      params![workspace_id, path, keep],
    )
    .unwrap_or(0)
}

#[tauri::command]
pub fn history_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  path: String,
) -> Result<Vec<VersionInfo>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  list_versions(&conn, &path)
}

#[tauri::command]
pub fn history_get<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  path: String,
  id: i64,
) -> Result<String, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  security::validate_path(&conn, &path)?;
  let ws_id = crate::util::find_workspace_id(&conn, std::path::Path::new(&path))?;
  let content: String = conn
    .query_row(
      "SELECT nv.content FROM note_versions nv
       JOIN notes n ON n.id = nv.note_id
       WHERE nv.id = ?1 AND n.workspace_id = ?2",
      rusqlite::params![id, ws_id],
      |r| r.get(0),
    )
    .map_err(|_| "Version not found".to_string())?;
  Ok(content)
}

#[tauri::command]
pub fn history_restore<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  path: String,
  id: i64,
) -> Result<(), String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
  }
  let db = app.state::<Database>();
  let content = {
    let conn = db.conn();
    fetch_version_content(&conn, id)?
  };
  if let Ok(current) = std::fs::read_to_string(&path) {
    if current != content {
      force_snapshot(&app, &path, &current)?;
    }
  }
  crate::workspace::note_write(app, path, content)
}

#[tauri::command]
pub fn history_prune<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  path: String,
  keep: Option<i64>,
) -> Result<usize, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let workspace_id = find_workspace_for_note(&conn, &path)?;
  Ok(prune_versions(
    &conn,
    workspace_id,
    &path,
    keep.unwrap_or(MAX_VERSIONS_PER_NOTE),
  ))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn setup_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
    let app = tauri::test::mock_app().handle().clone();
    {
      use tauri::Manager as _;
      let dir = std::env::temp_dir().join(format!("nexus_hist_ws_{}", std::process::id()));
      std::fs::create_dir_all(&dir).unwrap();
      let conn = rusqlite::Connection::open_in_memory().unwrap();
      conn.execute_batch(
        "CREATE TABLE workspaces (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')), last_opened_at TEXT);
         CREATE TABLE note_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, path TEXT NOT NULL, content TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
         CREATE TABLE files (id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, path TEXT NOT NULL, title TEXT, type TEXT NOT NULL DEFAULT 'note', size INTEGER NOT NULL DEFAULT 0, modified_at TEXT, indexed_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE (workspace_id, path));
         CREATE VIRTUAL TABLE note_index USING fts5(title, content, path UNINDEXED, workspace_id UNINDEXED);",
      )
      .unwrap();
      conn
        .execute(
          "INSERT INTO workspaces (name, path) VALUES ('WS', ?1)",
          params![dir.to_string_lossy()],
        )
        .unwrap();
      app.manage(Database(std::sync::Mutex::new(conn)));
    }
    app
  }

  fn ws_path() -> String {
    let dir = std::env::temp_dir().join(format!("nexus_hist_ws_{}", std::process::id()));
    dir.to_string_lossy().to_string()
  }

  #[test]
  fn snapshots_throttled_by_interval_and_content_change() {
    let app = setup_app();
    let path = format!("{}/note.md", ws_path());

    maybe_snapshot(&app, &path, "v1");
    // identical content immediately → no new version
    maybe_snapshot(&app, &path, "v1");
    // changed content but inside throttle window → no new version
    maybe_snapshot(&app, &path, "v2");

    {
      let db = app.state::<Database>();
      let n: i64 = db
        .conn()
        .query_row("SELECT COUNT(*) FROM note_versions", [], |r| r.get(0))
        .unwrap();
      assert_eq!(n, 1);
    }

    // backdate then change → new version
    {
      let db = app.state::<Database>();
      db.conn()
        .execute(
          "UPDATE note_versions SET created_at = datetime('now', '-10 minutes')",
          [],
        )
        .unwrap();
    }
    maybe_snapshot(&app, &path, "v2");
    {
      let db = app.state::<Database>();
      let n: i64 = db
        .conn()
        .query_row("SELECT COUNT(*) FROM note_versions", [], |r| r.get(0))
        .unwrap();
      assert_eq!(n, 2);
    }
  }

  #[test]
  fn lists_versions_newest_first() {
    let app = setup_app();
    let path = format!("{}/note.md", ws_path());
    force_snapshot(&app, &path, "a").unwrap();
    force_snapshot(&app, &path, "bb").unwrap();

    let db = app.state::<Database>();
    let versions = list_versions(&db.conn(), &path).unwrap();
    assert_eq!(versions.len(), 2);
    assert!(versions[0].id > versions[1].id);
    assert_eq!(versions[0].size, 2);
    assert!(!versions[0].created_at.is_empty());

    let other = list_versions(&db.conn(), "/elsewhere.md").unwrap();
    assert!(other.is_empty());
  }

  #[test]
  fn restore_writes_old_content_and_snapshots_current() {
    let app = setup_app();
    let dir = std::env::temp_dir().join(format!("nexus_hist_file_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let file = dir.join("doc.md");
    std::fs::write(&file, "original").unwrap();
    let path = file.to_string_lossy().to_string();

    // register the file's folder as its own workspace root
    {
      use rusqlite::params as p2;
      let db = app.state::<Database>();
      db.conn()
        .execute(
          "INSERT INTO workspaces (name, path) VALUES ('F', ?1)",
          p2![dir.to_string_lossy()],
        )
        .unwrap();
    }

    force_snapshot(&app, &path, "original").unwrap();
    std::fs::write(&file, "edited").unwrap();
    force_snapshot(&app, &path, "edited").unwrap();

    let db = app.state::<Database>();
    let first_id: i64 = db
      .conn()
      .query_row("SELECT MIN(id) FROM note_versions", [], |r| r.get(0))
      .unwrap();

    history_restore(app.clone(), path.clone(), first_id).unwrap();
    assert_eq!(std::fs::read_to_string(&file).unwrap(), "original");

    // safety snapshot of "edited"; the restored write is throttled (latest < 5 min old)
    let n: i64 = db
      .conn()
      .query_row("SELECT COUNT(*) FROM note_versions", [], |r| r.get(0))
      .unwrap();
    assert_eq!(n, 3);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_write_indexes_fts_and_snapshots() {
    let app = setup_app();
    let dir = std::env::temp_dir().join(format!("nexus_hist_int_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    // register the folder as workspace root
    {
      let db = app.state::<Database>();
      db.conn()
        .execute(
          "INSERT INTO workspaces (name, path) VALUES ('I', ?1)",
          params![dir.to_string_lossy()],
        )
        .unwrap();
    }

    let file = dir.join("doc.md");
    let path = file.to_string_lossy().to_string();
    crate::workspace::note_write(app.clone(), path.clone(), "# Doc\n\nzebra quantum notes".into())
      .unwrap();

    // file written to disk
    assert!(file.exists());

    // FTS index populated by sync_index
    let indexed: i64 = {
      let db = app.state::<Database>();
      let conn = db.conn();
      conn
        .query_row("SELECT COUNT(*) FROM note_index", [], |r| r.get(0))
        .unwrap()
    };
    assert_eq!(indexed, 1);

    // history snapshot created automatically
    let (count, content): (i64, String) = {
      let db = app.state::<Database>();
      let conn = db.conn();
      conn
        .query_row(
          "SELECT COUNT(*), MAX(content) FROM note_versions",
          [],
          |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap()
    };
    assert_eq!(count, 1);
    assert!(content.contains("zebra"));

    // rewriting within the throttle window does not add a version,
    // but updates the index
    crate::workspace::note_write(app.clone(), path.clone(), "# Doc\n\nupdated body".into()).unwrap();
    let count: i64 = {
      let db = app.state::<Database>();
      let conn = db.conn();
      conn
        .query_row("SELECT COUNT(*) FROM note_versions", [], |r| r.get(0))
        .unwrap()
    };
    assert_eq!(count, 1);
    let fts_content: String = {
      let db = app.state::<Database>();
      let conn = db.conn();
      conn
        .query_row("SELECT content FROM note_index LIMIT 1", [], |r| r.get(0))
        .unwrap()
    };
    assert!(fts_content.contains("updated body"));

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn prune_keeps_newest_n() {
    let app = setup_app();
    let path = format!("{}/note.md", ws_path());
    for v in ["1", "2", "3", "4", "5"] {
      force_snapshot(&app, &path, v).unwrap();
    }
    let db = app.state::<Database>();
    let removed = {
      let conn = db.conn();
      let ws_id = find_workspace_for_note(&conn, &path).unwrap();
      prune_versions(&conn, ws_id, &path, 2)
    };
    assert_eq!(removed, 3);
    let contents: Vec<String> = {
      let conn = db.conn();
      let mut stmt = conn
        .prepare("SELECT content FROM note_versions ORDER BY id")
        .unwrap();
      let rows = stmt.query_map([], |r| r.get(0)).unwrap();
      rows.map(|r| r.unwrap()).collect()
    };
    assert_eq!(contents, vec!["4".to_string(), "5".to_string()]);
  }
}
