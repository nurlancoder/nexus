use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine as _;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::db::Database;
use crate::workspace::{flatten_public, scan_dir_public};

const ATTACHMENTS_DIR: &str = "06-Attachments";
const MAX_ATTACHMENT_SIZE: usize = 50 * 1024 * 1024;

#[derive(Serialize)]
pub struct AttachmentInfo {
  pub path: String,
  pub name: String,
  pub size: u64,
  pub kind: String,
}

fn kind_for(name: &str) -> String {
  let ext = Path::new(name)
    .extension()
    .map(|e| e.to_string_lossy().to_lowercase())
    .unwrap_or_default();
  match ext.as_str() {
    "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "ico" => "image".into(),
    "pdf" => "pdf".into(),
    _ => "other".into(),
  }
}

fn sanitize_name(name: &str) -> String {
  let cleaned = name
    .replace('\0', "")
    .replace('\\', "/")
    .rsplit('/')
    .next()
    .unwrap_or("file")
    .trim()
    .to_string();
  if cleaned.is_empty() || cleaned == "." || cleaned == ".." || cleaned.starts_with('.') {
    "file".to_string()
  } else {
    cleaned
  }
}

fn unique_path(dir: &Path, name: &str) -> PathBuf {
  let mut candidate = dir.join(name);
  let mut i = 2;
  while candidate.exists() {
    let stem = Path::new(name)
      .file_stem()
      .map(|s| s.to_string_lossy().to_string())
      .unwrap_or_else(|| name.to_string());
    let ext = Path::new(name)
      .extension()
      .map(|e| format!(".{}", e.to_string_lossy()))
      .unwrap_or_default();
    candidate = dir.join(format!("{stem} {i}{ext}"));
    i += 1;
  }
  candidate
}

fn info_for(path: &Path) -> AttachmentInfo {
  let name = path
    .file_name()
    .map(|n| n.to_string_lossy().to_string())
    .unwrap_or_default();
  let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
  AttachmentInfo {
    path: path.to_string_lossy().to_string(),
    kind: kind_for(&name),
    name,
    size,
  }
}

fn save_attachment_inner(
  workspace_path: &str,
  name: &str,
  data_base64: &str,
  max_size: usize,
) -> Result<AttachmentInfo, String> {
  let clean = sanitize_name(name);
  if data_base64.is_empty() {
    return Err("Empty attachment data".into());
  }
  let bytes = BASE64
    .decode(data_base64)
    .map_err(|_| "Invalid base64 data".to_string())?;
  if bytes.len() > max_size {
    return Err(format!("Attachment exceeds maximum size of {} bytes", max_size));
  }
  let dir = Path::new(workspace_path).join(ATTACHMENTS_DIR);
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = unique_path(&dir, &clean);
  std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
  Ok(info_for(&path))
}

pub fn save_attachment(
  workspace_path: &str,
  name: &str,
  data_base64: &str,
) -> Result<AttachmentInfo, String> {
  save_attachment_inner(workspace_path, name, data_base64, MAX_ATTACHMENT_SIZE)
}

pub fn list_attachments(workspace_path: &str) -> Result<Vec<AttachmentInfo>, String> {
  let root = Path::new(workspace_path).join(ATTACHMENTS_DIR);
  if !root.is_dir() {
    return Ok(Vec::new());
  }
  let tree = scan_dir_public(&root)?;
  let mut flat = Vec::new();
  flatten_public(&tree, &mut flat);
  let mut out: Vec<AttachmentInfo> = flat
    .iter()
    .filter(|n| !n.is_dir)
    .map(|n| info_for(Path::new(&n.path)))
    .collect();
  out.sort_by_key(|a| a.name.to_lowercase());
  Ok(out)
}

#[tauri::command]
pub fn attachment_save<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  name: String,
  data_base64: String,
) -> Result<AttachmentInfo, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    crate::search::find_workspace_id_for_path(&conn, &workspace_path)?;
  }
  save_attachment(&workspace_path, &name, &data_base64)
}

#[tauri::command]
pub fn attachment_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<AttachmentInfo>, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    crate::search::find_workspace_id_for_path(&conn, &workspace_path)?;
  }
  list_attachments(&workspace_path)
}

#[tauri::command]
pub fn attachment_read<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
  }
  let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
  Ok(BASE64.encode(bytes))
}

#[tauri::command]
pub fn attachment_delete<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<(), String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
  }
  std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

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
      rusqlite::params![std::path::Path::new(path).file_name().unwrap().to_str().unwrap(), path],
    )
    .unwrap();
  }

  fn setup_ws(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("nexus_test_att_{label}_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  // PNG magic bytes for realistic data
  const PNG_BYTES: &[u8] = &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const PNG_B64: &str = "iVBORw0KGgo=";

  #[test]
  fn saves_decodes_and_avoids_collisions() {
    let ws = setup_ws("save");
    let wsp = ws.to_str().unwrap();

    let a = save_attachment(wsp, "pic.png", PNG_B64).unwrap();
    assert!(a.path.ends_with("pic.png"));
    assert_eq!(a.kind, "image");
    assert_eq!(std::fs::read(&a.path).unwrap(), PNG_BYTES);

    let b = save_attachment(wsp, "pic.png", PNG_B64).unwrap();
    assert!(b.path.ends_with("pic 2.png"));

    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn sanitizes_unsafe_names() {
    let ws = setup_ws("sanitize");
    let wsp = ws.to_str().unwrap();

    let a = save_attachment(wsp, "../../etc/passwd.png", PNG_B64).unwrap();
    assert!(a.path.contains("06-Attachments"), "stays inside attachments");
    assert!(a.name == "passwd.png");

    let b = save_attachment(wsp, ".hidden", PNG_B64).unwrap();
    assert_eq!(b.name, "file");

    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn lists_kinds_and_sizes_sorted() {
    let ws = setup_ws("list");
    let wsp = ws.to_str().unwrap();
    save_attachment(wsp, "b.pdf", PNG_B64).unwrap();
    save_attachment(wsp, "a.png", PNG_B64).unwrap();
    save_attachment(wsp, "c.zip", PNG_B64).unwrap();

    let items = list_attachments(wsp).unwrap();
    let names: Vec<&str> = items.iter().map(|i| i.name.as_str()).collect();
    assert_eq!(names, vec!["a.png", "b.pdf", "c.zip"]);
    assert_eq!(items[0].kind, "image");
    assert_eq!(items[1].kind, "pdf");
    assert_eq!(items[2].kind, "other");
    assert!(items.iter().all(|i| i.size > 0));

    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn sanitize_name_rejects_null_bytes() {
    let ws = setup_ws("nullname");
    let wsp = ws.to_str().unwrap();

    let a = save_attachment(wsp, "file\0.png", PNG_B64).unwrap();
    // The null byte should be stripped, leaving a valid name
    assert!(!a.name.contains('\0'));

    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn attachment_save_rejects_oversized_data() {
    let ws = setup_ws("oversize");
    let wsp = ws.to_str().unwrap();

    // 4-byte B64 decodes to 3 bytes — over the 2-byte limit
    assert!(save_attachment_inner(wsp, "big.png", "AQID", 2).is_err());
    // Exactly at the limit — should succeed
    assert!(save_attachment_inner(wsp, "small.png", "AQID", 3).is_ok());
    // Well under limit — ok
    assert!(save_attachment_inner(wsp, "tiny.png", "AQID", 100).is_ok());

    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn rejects_bad_base64_and_empty_data() {
    let ws = setup_ws("badb64");
    let wsp = ws.to_str().unwrap();
    assert!(save_attachment(wsp, "x.png", "!!!not-base64!!!").is_err());
    assert!(save_attachment(wsp, "x.png", "").is_err());
    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn attachment_save_rejects_unknown_workspace() {
    let app = mock_app();
    let ws = setup_ws("att_ws_save");
    register_ws(&app, ws.to_str().unwrap());

    assert!(attachment_save(app.clone(), ws.to_str().unwrap().to_string(), "ok.png".into(), PNG_B64.into()).is_ok());

    let outside = std::env::temp_dir().join("nexus_att_unknown_ws");
    std::fs::create_dir_all(&outside).unwrap();
    assert!(attachment_save(app, outside.to_str().unwrap().to_string(), "bad.png".into(), PNG_B64.into()).is_err());

    std::fs::remove_dir_all(&ws).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
  }

  #[test]
  fn attachment_list_rejects_unknown_workspace() {
    let app = mock_app();
    let ws = setup_ws("att_ws_list");
    register_ws(&app, ws.to_str().unwrap());

    assert!(attachment_list(app.clone(), ws.to_str().unwrap().to_string()).is_ok());

    let outside = std::env::temp_dir().join("nexus_att_unknown_ws_list");
    std::fs::create_dir_all(&outside).unwrap();
    assert!(attachment_list(app, outside.to_str().unwrap().to_string()).is_err());

    std::fs::remove_dir_all(&ws).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
  }

  #[test]
  fn missing_folder_lists_empty_and_delete_works() {
    let ws = setup_ws("delete");
    assert!(list_attachments(ws.to_str().unwrap()).unwrap().is_empty());

    let a = save_attachment(ws.to_str().unwrap(), "gone.png", PNG_B64).unwrap();
    let app = mock_app();
    register_ws(&app, ws.to_str().unwrap());
    attachment_delete(app, a.path.clone()).unwrap();
    assert!(!Path::new(&a.path).exists());

    std::fs::remove_dir_all(&ws).unwrap();
  }
}
