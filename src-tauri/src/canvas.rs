use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::db::Database;
use crate::security;

pub const EMPTY_CANVAS: &str = r#"{"nodes":[],"edges":[],"groups":[],"viewport":{"x":0,"y":0,"zoom":1}}"#;

#[tauri::command]
pub fn canvas_create<R: tauri::Runtime>(app: tauri::AppHandle<R>, parent: String, title: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    security::validate_path(&db.conn(), &parent)?;
  }
  let dir = Path::new(&parent);
  if !dir.is_dir() {
    return Err("Parent is not a directory".into());
  }
  let clean = title.trim();
  let base = if clean.is_empty() {
    "Untitled".to_string()
  } else {
    crate::util::slugify(clean)
  };
  let path = crate::util::unique_path(dir, &base, ".canvas");
  std::fs::write(&path, EMPTY_CANVAS).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn canvas_save<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String, content: String) -> Result<(), String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
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
  std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
  std::fs::rename(&tmp, &p).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn canvas_load<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
  }
  std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn canvas_create_writes_empty_and_avoids_collision() {
    let app = crate::test_helpers::mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_canvas_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    crate::test_helpers::register_ws(&app, &dir.to_string_lossy());

    let p1 = canvas_create(app.clone(), dir.to_string_lossy().to_string(), "My Canvas".into()).unwrap();
    let p2 = canvas_create(app, dir.to_string_lossy().to_string(), "My Canvas".into()).unwrap();

    assert!(p1.ends_with("My Canvas.canvas"));
    assert!(p2.ends_with("My Canvas 2.canvas"));
    assert_eq!(std::fs::read_to_string(&p1).unwrap(), EMPTY_CANVAS);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn canvas_create_rejects_parent_outside_workspace() {
    let app = crate::test_helpers::mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_cc_val_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    crate::test_helpers::register_ws(&app, &dir.to_string_lossy());

    assert!(canvas_create(app.clone(), dir.to_string_lossy().to_string(), "Good".into()).is_ok());

    let outside = std::env::temp_dir().join("nexus_cc_outside");
    std::fs::create_dir_all(&outside).unwrap();
    assert!(canvas_create(app, outside.to_string_lossy().to_string(), "Bad".into()).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
  }

  #[test]
  fn canvas_save_load_roundtrip() {
    let app = crate::test_helpers::mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_canvas2_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    crate::test_helpers::register_ws(&app, &dir.to_string_lossy());
    let path = dir.join("c.canvas");

    canvas_save(
      app.clone(),
      path.to_string_lossy().to_string(),
      r#"{"nodes":[{"id":"n1"}],"edges":[],"groups":[]}"#.into(),
    )
    .unwrap();

    let loaded = canvas_load(app, path.to_string_lossy().to_string()).unwrap();
    assert!(loaded.contains("n1"));

    std::fs::remove_dir_all(&dir).unwrap();
  }
}