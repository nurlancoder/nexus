use rusqlite::params;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

use crate::db::Database;
use crate::security;

const WORKSPACE_FOLDERS: [&str; 9] = [
  "00-Inbox",
  "01-Notes",
  "02-Projects",
  "03-Areas",
  "04-Resources",
  "05-Archive",
  "06-Attachments",
  "07-Templates",
  "08-Canvas",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
  pub id: i64,
  pub name: String,
  pub path: String,
  pub created_at: String,
  pub last_opened_at: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
  pub name: String,
  pub path: String,
  pub is_dir: bool,
  pub children: Vec<FileNode>,
}

fn scan_dir(dir: &Path) -> Result<Vec<FileNode>, String> {
  let mut nodes = Vec::new();
  let rd = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
  for entry in rd.flatten() {
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') {
      continue;
    }
    let path = entry.path();
    let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
    let children = if is_dir {
      scan_dir(&path)?
    } else {
      Vec::new()
    };
    nodes.push(FileNode {
      name,
      path: path.to_string_lossy().to_string(),
      is_dir,
      children,
    });
  }
  nodes.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
  Ok(nodes)
}

fn upsert_workspace(app: &AppHandle, name: &str, path: &Path) -> Result<(), String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  conn.execute(
    "INSERT INTO workspaces (name, path, last_opened_at)
     VALUES (?1, ?2, datetime('now'))
     ON CONFLICT(path) DO UPDATE SET name = excluded.name, last_opened_at = datetime('now')",
    params![name, path.to_string_lossy()],
  )
  .map_err(|e| e.to_string())?;
  Ok(())
}

fn get_workspace(app: &AppHandle, path: &Path) -> Result<WorkspaceInfo, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  conn.query_row(
    "SELECT id, name, path, created_at, last_opened_at
     FROM workspaces WHERE path = ?1",
    params![path.to_string_lossy()],
    |r| {
      Ok(WorkspaceInfo {
        id: r.get(0)?,
        name: r.get(1)?,
        path: r.get(2)?,
        created_at: r.get(3)?,
        last_opened_at: r.get(4)?,
      })
    },
  )
  .map_err(|e| e.to_string())
}

fn flatten<'a>(nodes: &'a [FileNode], out: &mut Vec<&'a FileNode>) {
  for n in nodes {
    out.push(n);
    flatten(&n.children, out);
  }
}

pub fn scan_dir_public(dir: &Path) -> Result<Vec<FileNode>, String> {
  scan_dir(dir)
}

pub fn flatten_public<'a>(nodes: &'a [FileNode], out: &mut Vec<&'a FileNode>) {
  flatten(nodes, out)
}

pub fn unique_path_public(dir: &Path, base: &str, suffix: &str) -> PathBuf {
  unique_path(dir, base, suffix)
}

fn index_files(app: &AppHandle, root: &Path) -> Result<usize, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let ws = get_workspace(app, root)?;
  let nodes = scan_dir(root)?;
  let mut flat = Vec::new();
  flatten(&nodes, &mut flat);

  let mut count = 0;
  for n in flat {
    if n.is_dir {
      continue;
    }
    let ext = Path::new(&n.name)
      .extension()
      .map(|e| e.to_string_lossy().to_lowercase())
      .unwrap_or_default();
    if ext != "md" && ext != "markdown" && ext != "txt" {
      continue;
    }
    let meta = std::fs::metadata(&n.path).map_err(|e| e.to_string())?;
    let modified = meta
      .modified()
      .ok()
      .map(|t| format!("{:?}", t))
      .unwrap_or_default();
    conn.execute(
      "INSERT INTO files (workspace_id, path, title, type, size, modified_at, indexed_at)
       VALUES (?1, ?2, ?3, 'note', ?4, ?5, datetime('now'))
       ON CONFLICT(workspace_id, path) DO UPDATE SET
         size = excluded.size,
         modified_at = excluded.modified_at,
         indexed_at = datetime('now')",
      params![ws.id, n.path, n.name.trim_end_matches(".md"), meta.len(), modified],
    )
    .map_err(|e| e.to_string())?;
    count += 1;
  }
  Ok(count)
}

fn validate_workspace_create(parent_path: &str, name: &str) -> Result<(), String> {
  if parent_path.contains('\0') || name.contains('\0') {
    return Err("Path contains null byte".into());
  }
  if name.contains("..") || name.contains('/') || name.contains('\\') {
    return Err("Workspace name must not contain path separators or traversal".into());
  }
  let parent = Path::new(parent_path);
  if !parent.is_dir() {
    return Err("Parent directory does not exist or is not a directory".into());
  }
  Ok(())
}

#[tauri::command]
pub fn workspace_create(app: AppHandle, name: String, parent_path: String) -> Result<WorkspaceInfo, String> {
  validate_workspace_create(&parent_path, &name)?;
  let root = Path::new(&parent_path).join(&name);
  if root.exists() {
    return Err(format!("Folder already exists: {}", root.display()));
  }
  for folder in WORKSPACE_FOLDERS {
    std::fs::create_dir_all(root.join(folder)).map_err(|e| e.to_string())?;
  }
  std::fs::create_dir_all(root.join(".nexus/cache")).map_err(|e| e.to_string())?;
  std::fs::create_dir_all(root.join(".nexus/indexes")).map_err(|e| e.to_string())?;

  let settings = serde_json::json!({ "name": name, "version": env!("CARGO_PKG_VERSION") });
  std::fs::write(
    root.join(".nexus/settings.json"),
    serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())?;

  let workspace_json = serde_json::json!({ "name": name, "path": root.to_string_lossy() });
  std::fs::write(
    root.join(".nexus/workspace.json"),
    serde_json::to_string_pretty(&workspace_json).map_err(|e| e.to_string())?,
  )
  .map_err(|e| e.to_string())?;

  upsert_workspace(&app, &name, &root)?;
  index_files(&app, &root)?;
  crate::search::reindex_workspace(&app, &root)?;
  get_workspace(&app, &root)
}

#[tauri::command]
pub fn workspace_open(app: AppHandle, path: String) -> Result<WorkspaceInfo, String> {
  if path.contains('\0') {
    return Err("Path contains null byte".into());
  }
  let root = Path::new(&path);
  if !root.is_dir() {
    return Err("Not a directory".into());
  }
  let name = root
    .file_name()
    .map(|n| n.to_string_lossy().to_string())
    .unwrap_or_else(|| "Workspace".into());
  upsert_workspace(&app, &name, root)?;
  index_files(&app, root)?;
  crate::search::reindex_workspace(&app, root)?;
  get_workspace(&app, root)
}

#[tauri::command]
pub fn workspace_recent(app: AppHandle) -> Result<Vec<WorkspaceInfo>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let mut stmt = conn
    .prepare(
      "SELECT id, name, path, created_at, last_opened_at
       FROM workspaces ORDER BY last_opened_at DESC LIMIT 20",
    )
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map([], |r| {
      Ok(WorkspaceInfo {
        id: r.get(0)?,
        name: r.get(1)?,
        path: r.get(2)?,
        created_at: r.get(3)?,
        last_opened_at: r.get(4)?,
      })
    })
    .map_err(|e| e.to_string())?;
  let mut out = Vec::new();
  for r in rows {
    out.push(r.map_err(|e| e.to_string())?);
  }
  Ok(out)
}

#[tauri::command]
pub fn workspace_tree<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<Vec<FileNode>, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    crate::search::find_workspace_id_for_path(&conn, &path)?;
  }
  scan_dir(Path::new(&path))
}

fn sync_index<R: tauri::Runtime>(app: &tauri::AppHandle<R>, path: &str) {
  let Some(db) = app.try_state::<Database>() else { return };
  let conn = db.conn();
  let Ok(workspace_id) = crate::search::find_workspace_id_for_path(&conn, path) else {
    return;
  };
  let _ = crate::search::index_note(&conn, workspace_id, path);
}

fn sync_index_remove<R: tauri::Runtime>(app: &tauri::AppHandle<R>, path: &str) {
  let Some(db) = app.try_state::<Database>() else { return };
  let _ = crate::search::remove_note(&db.conn(), path);
}

#[tauri::command]
pub fn note_write<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  path: String,
  content: String,
) -> Result<(), String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &path)?;
  }
  let p = PathBuf::from(&path);
  if let Some(parent) = p.parent() {
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  let tmp = p.with_extension("tmp");
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &tmp.to_string_lossy())?;
  }
  std::fs::write(&tmp, &content).map_err(|e| e.to_string())?;
  std::fs::rename(&tmp, &p).map_err(|e| e.to_string())?;
  sync_index(&app, &path);
  crate::history::maybe_snapshot(&app, &path, &content);
  Ok(())
}

fn slugify(name: &str) -> String {
  crate::util::slugify(name)
}

fn unique_path(dir: &Path, base: &str, suffix: &str) -> PathBuf {
  crate::util::unique_path(dir, base, suffix)
}

fn today() -> String {
  crate::util::today()
}

#[tauri::command]
pub fn note_create<R: tauri::Runtime>(app: tauri::AppHandle<R>, parent: String, title: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &parent)?;
  }
  let dir = Path::new(&parent);
  if !dir.is_dir() {
    return Err("Parent is not a directory".into());
  }
  let clean_title = title.trim().to_string();
  let base = if clean_title.is_empty() {
    "Untitled".to_string()
  } else {
    slugify(&clean_title)
  };
  let path = unique_path(dir, &base, ".md");
  let now = today();
  let content = format!(
    "---\ntitle: {}\ntype: note\ncreated: {}\nupdated: {}\ntags:\n\n---\n\n# {}\n",
    clean_title, now, now, clean_title
  );
  std::fs::write(&path, content).map_err(|e| e.to_string())?;
  sync_index(&app, &path.to_string_lossy());
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn note_rename<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String, new_name: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &path)?;
  }
  let old = PathBuf::from(&path);
  if !old.is_file() {
    return Err("Not a file".into());
  }
  let parent = old.parent().ok_or("No parent directory")?;
  let base = if new_name.trim().is_empty() {
    "Untitled".to_string()
  } else {
    slugify(&new_name)
  };
  let new_path = parent.join(format!("{base}.md"));
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &new_path.to_string_lossy())?;
  }
  std::fs::rename(&old, &new_path).map_err(|e| e.to_string())?;
  sync_index_remove(&app, &path);
  sync_index(&app, &new_path.to_string_lossy());
  Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn note_delete<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &path)?;
  }
  std::fs::remove_file(&path).map_err(|e| e.to_string())?;
  sync_index_remove(&app, &path);
  Ok(())
}

#[tauri::command]
pub fn note_move<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String, target_dir: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    security::validate_path(&conn, &path)?;
    security::validate_path(&conn, &target_dir)?;
  }
  let old = PathBuf::from(&path);
  let name = old.file_name().ok_or("No filename")?;
  let new_path = Path::new(&target_dir).join(name);
  if new_path.exists() {
    return Err("A file with this name already exists in the target".into());
  }
  std::fs::create_dir_all(Path::new(&target_dir)).map_err(|e| e.to_string())?;
  std::fs::rename(&old, &new_path).map_err(|e| e.to_string())?;
  sync_index_remove(&app, &path);
  sync_index(&app, &new_path.to_string_lossy());
  Ok(new_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn note_read<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &path)?;
  }
  std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn note_duplicate<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &path)?;
  }
  let old = PathBuf::from(&path);
  if !old.is_file() {
    return Err("Not a file".into());
  }
  let parent = old.parent().ok_or("No parent directory")?;
  let name = old
    .file_stem()
    .and_then(|s| s.to_str())
    .unwrap_or("Untitled");
  let new_path = unique_path(parent, name, " copy.md");
  std::fs::copy(&old, &new_path).map_err(|e| e.to_string())?;
  sync_index(&app, &new_path.to_string_lossy());
  Ok(new_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn file_node_serializes_camel_case_for_frontend() {
    let n = FileNode {
      name: "a".into(),
      path: "/w/a".into(),
      is_dir: true,
      children: vec![],
    };
    let v = serde_json::to_value(&n).unwrap();
    assert_eq!(v["isDir"], true);
    assert!(v.get("is_dir").is_none());
  }

  fn mock_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
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
      CREATE VIRTUAL TABLE IF NOT EXISTS note_index USING fts5(
        title, content, path UNINDEXED, workspace_id UNINDEXED
      );",
    )
    .unwrap();
    app.manage(crate::db::Database(std::sync::Mutex::new(conn)));
    app.handle().clone()
  }

  fn register_ws(app: &tauri::AppHandle<tauri::test::MockRuntime>, path: &str) {
    let db = app.state::<crate::db::Database>();
    let conn = db.conn();
    conn.execute(
      "INSERT INTO workspaces (name, path) VALUES (?1, ?2)",
      params![std::path::Path::new(path).file_name().unwrap().to_str().unwrap(), path],
    )
    .unwrap();
  }

  #[test]
  fn scan_dir_builds_tree_and_skips_hidden() {
    let dir = std::env::temp_dir().join(format!("nexus_test_scan_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("sub/.nexus")).unwrap();
    std::fs::write(dir.join("a.md"), "# A").unwrap();
    std::fs::write(dir.join("sub/b.md"), "# B").unwrap();
    std::fs::write(dir.join("sub/.hidden.md"), "hidden").unwrap();

    let tree = scan_dir(&dir).unwrap();
    let dirs: Vec<&str> = tree.iter().filter(|n| n.is_dir).map(|n| n.name.as_str()).collect();
    let files: Vec<&str> = tree.iter().filter(|n| !n.is_dir).map(|n| n.name.as_str()).collect();

    assert_eq!(dirs, vec!["sub"]);
    assert_eq!(files, vec!["a.md"]);

    let sub = tree.iter().find(|n| n.name == "sub").unwrap();
    let sub_files: Vec<&str> = sub.children.iter().map(|n| n.name.as_str()).collect();
    assert_eq!(sub_files, vec!["b.md"]);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_write_is_atomic_roundtrip() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_write_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());
    let path = dir.join("nested/note.md");
    note_write(
      app.clone(),
      path.to_string_lossy().to_string(),
      "# Hello".into(),
    )
    .unwrap();
    let read = note_read(app, path.to_string_lossy().to_string()).unwrap();
    assert_eq!(read, "# Hello");
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_create_writes_frontmatter_and_avoids_collision() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_create_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());

    let p1 = note_create(app.clone(), dir.to_string_lossy().to_string(), "My Note".into()).unwrap();
    let p2 = note_create(app, dir.to_string_lossy().to_string(), "My Note".into()).unwrap();

    assert!(p1.ends_with("My Note.md"));
    assert!(p2.ends_with("My Note 2.md"));

    let content = std::fs::read_to_string(&p1).unwrap();
    assert!(content.contains("title: My Note"));
    assert!(content.contains("type: note"));
    assert!(content.contains("created: "));

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn workspace_tree_rejects_path_outside_workspace() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_wstree_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());

    // Inside workspace — ok
    assert!(workspace_tree(app.clone(), dir.to_string_lossy().to_string()).is_ok());

    // Outside workspace — rejected
    let outside = std::env::temp_dir().join("nexus_definitely_not_registered");
    assert!(workspace_tree(app, outside.to_string_lossy().to_string()).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_create_rejects_parent_outside_workspace() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_nc_val_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());

    assert!(note_create(app.clone(), dir.to_string_lossy().to_string(), "Good".into()).is_ok());

    let outside = std::env::temp_dir().join("nexus_no_such_ws");
    std::fs::create_dir_all(&outside).unwrap();
    assert!(note_create(app, outside.to_string_lossy().to_string(), "Bad".into()).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
  }

  #[test]
  fn note_read_rejects_path_traversal_outside_workspace() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_read_sec_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());
    std::fs::write(dir.join("ok.md"), "safe content").unwrap();

    // Valid path — reads successfully
    let content = note_read(app.clone(), dir.join("ok.md").to_string_lossy().to_string()).unwrap();
    assert_eq!(content, "safe content");

    // Path traversal — rejected
    let traversal = dir.join("../../etc/passwd").to_string_lossy().to_string();
    assert!(note_read(app.clone(), traversal).is_err());

    // Absolute outside-workspace — rejected
    assert!(note_read(app.clone(), "/etc/passwd".into()).is_err());

    // Null byte — rejected
    let null_path = dir.join("file\0.md").to_string_lossy().to_string();
    assert!(note_read(app.clone(), null_path).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_write_rejects_path_traversal_outside_workspace() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_write_sec_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());

    // Valid path — writes successfully
    let ok_path = dir.join("ok.md").to_string_lossy().to_string();
    note_write(app.clone(), ok_path.clone(), "safe content".into()).unwrap();
    assert_eq!(std::fs::read_to_string(&ok_path).unwrap(), "safe content");

    // Path traversal — rejected
    let traversal = dir.join("../../etc/evil.md").to_string_lossy().to_string();
    assert!(note_write(app.clone(), traversal, "evil".into()).is_err());
    // Ensure no file was created at the traversal target
    assert!(!std::path::Path::new("/etc/evil.md").exists());

    // Absolute outside-workspace — rejected
    assert!(note_write(app.clone(), "/tmp/evil.md".into(), "evil".into()).is_err());
    assert!(!std::path::Path::new("/tmp/evil.md").exists());

    // Null byte — rejected
    let null_path = dir.join("file\0.md").to_string_lossy().to_string();
    assert!(note_write(app.clone(), null_path, "evil".into()).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_write_rejects_symlink_escape() {
    let tmp = std::env::temp_dir().join(format!("nexus_test_write_symlink_{}", std::process::id()));
    let ws = tmp.join("workspace");
    let outside = tmp.join("outside");
    std::fs::create_dir_all(ws.join("sub")).unwrap();
    std::fs::create_dir_all(&outside).unwrap();

    let app = mock_app();
    register_ws(&app, &ws.to_string_lossy());

    // Create symlink inside workspace pointing outside
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, ws.join("sub/escape")).unwrap();

    let bad_path = ws.join("sub/escape/secret.txt").to_string_lossy().to_string();
    assert!(note_write(app.clone(), bad_path, "evil".into()).is_err());
    assert!(!outside.join("secret.txt").exists());

    std::fs::remove_dir_all(&tmp).unwrap();
  }

  #[test]
  fn note_read_rejects_symlink_escape() {
    let tmp = std::env::temp_dir().join(format!("nexus_test_read_symlink_{}", std::process::id()));
    let ws = tmp.join("workspace");
    let outside = tmp.join("outside");
    std::fs::create_dir_all(ws.join("sub")).unwrap();
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("secret.txt"), "stolen").unwrap();

    let app = mock_app();
    register_ws(&app, &ws.to_string_lossy());

    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, ws.join("sub/escape")).unwrap();

    let bad_path = ws.join("sub/escape/secret.txt").to_string_lossy().to_string();
    assert!(note_read(app.clone(), bad_path).is_err());

    std::fs::remove_dir_all(&tmp).unwrap();
  }

  #[test]
  fn note_duplicate_and_rename_work() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_crud_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());
    let path = note_create(app.clone(), dir.to_string_lossy().to_string(), "Origin".into()).unwrap();

    let dup = note_duplicate(app.clone(), path.clone()).unwrap();
    assert!(dup.ends_with("Origin copy.md"));

    let renamed = note_rename(app.clone(), dup, "Renamed".to_string()).unwrap();
    assert!(renamed.ends_with("Renamed.md"));
    assert!(std::path::Path::new(&renamed).is_file());

    note_delete(app, renamed.clone()).unwrap();
    assert!(!std::path::Path::new(&renamed).exists());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn workspace_create_rejects_null_bytes() {
    let dir = std::env::temp_dir().join(format!("nexus_test_ws_create_null_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();

    assert!(validate_workspace_create("name\0evil", dir.to_str().unwrap()).is_err());
    assert!(validate_workspace_create("name", &dir.join("sub\0").to_string_lossy()).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn workspace_create_rejects_nonexistent_parent() {
    let outside = std::env::temp_dir().join("nexus_ws_nonexistent_parent");
    assert!(validate_workspace_create(outside.to_str().unwrap(), "test").is_err());
  }

  #[test]
  fn workspace_create_rejects_name_traversal() {
    let dir = std::env::temp_dir().join(format!("nexus_test_ws_traversal_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let parent = dir.to_str().unwrap();

    assert!(validate_workspace_create(parent, "../evil").is_err());
    assert!(validate_workspace_create(parent, "a/b").is_err());
    assert!(validate_workspace_create(parent, "a\\b").is_err());
    assert!(validate_workspace_create(parent, "valid-name").is_ok());

    std::fs::remove_dir_all(&dir).unwrap();
  }
}