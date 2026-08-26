use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::db::Database;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInfo {
  pub name: String,
  pub path: String,
}

const SAMPLE_PLUGIN: &str = r#"// Nexus sample plugin.
// Plugins are plain JavaScript files in <vault>/plugins/.
// API: nx.registerCommand({id,title,run}), nx.on(event, handler),
// nx.getActiveNote(), nx.readNote(path), nx.writeNote(path, content),
// nx.log(msg), nx.today()

nx.registerCommand({
  id: 'insert-date',
  title: 'Sample: insert today below the first heading',
  run: function () {
    var note = nx.getActiveNote()
    if (!note || !note.content) return
    var updated = note.content.replace(
      /^(# .*\n)/,
      '$1\n' + nx.today() + '\n'
    )
    if (updated !== note.content) {
      nx.writeNote(note.path, updated)
      nx.log('Inserted date into ' + note.path)
    }
  },
})

nx.on('note:open', function (note) {
  nx.log('opened: ' + note.path)
})
"#;

fn plugins_root(workspace_path: &str) -> PathBuf {
  Path::new(workspace_path).join("plugins")
}

fn sanitize_name(name: &str) -> Result<String, String> {
  let trimmed = name.trim();
  if trimmed.is_empty() || trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..")
  {
    return Err("Invalid plugin name".into());
  }
  Ok(trimmed.to_string())
}

/// Creates the plugins folder with a sample plugin on first use.
pub fn ensure_plugins_dir(workspace_path: &str) -> PathBuf {
  let dir = plugins_root(workspace_path);
  let _ = std::fs::create_dir_all(&dir);
  let sample = dir.join("hello.js");
  if !sample.exists() {
    let _ = std::fs::write(&sample, SAMPLE_PLUGIN);
  }
  dir
}

pub fn list_plugins(workspace_path: &str) -> Result<Vec<PluginInfo>, String> {
  let dir = ensure_plugins_dir(workspace_path);
  let mut out = Vec::new();
  let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
  for entry in entries {
    let entry = entry.map_err(|e| e.to_string())?;
    let path = entry.path();
    if !path.is_file() {
      continue;
    }
    let ext = path
      .extension()
      .map(|e| e.to_string_lossy().to_lowercase())
      .unwrap_or_default();
    if ext != "js" {
      continue;
    }
    let name = path
      .file_name()
      .map(|s| s.to_string_lossy().to_string())
      .unwrap_or_default();
    out.push(PluginInfo {
      path: path.to_string_lossy().to_string(),
      name,
    });
  }
  out.sort_by_key(|a| a.name.to_lowercase());
  Ok(out)
}

pub fn read_plugin(workspace_path: &str, name: &str) -> Result<String, String> {
  let name = sanitize_name(name)?;
  let path = plugins_root(workspace_path).join(&name);
  if !path.is_file() {
    return Err(format!("Plugin not found: {}", name));
  }
  std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn plugin_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<PluginInfo>, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    crate::search::find_workspace_id_for_path(&conn, &workspace_path)?;
  }
  list_plugins(&workspace_path)
}

#[tauri::command]
pub fn plugin_read<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  name: String,
) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    crate::search::find_workspace_id_for_path(&conn, &workspace_path)?;
  }
  read_plugin(&workspace_path, &name)
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

  #[test]
  fn seeds_sample_and_lists_sorted() {
    let dir = std::env::temp_dir().join(format!("nexus_plugins_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let ws = dir.to_string_lossy().to_string();

    let plugins = list_plugins(&ws).unwrap();
    assert_eq!(plugins.len(), 1);
    assert_eq!(plugins[0].name, "hello.js");

    // extra files: only .js listed, sorted case-insensitively
    let pdir = dir.join("plugins");
    std::fs::write(pdir.join("zeta.js"), "// z").unwrap();
    std::fs::write(pdir.join("Alpha.js"), "// a").unwrap();
    std::fs::write(pdir.join("notes.txt"), "nope").unwrap();
    let plugins = list_plugins(&ws).unwrap();
    let names: Vec<&str> = plugins.iter().map(|p| p.name.as_str()).collect();
    assert_eq!(names, vec!["Alpha.js", "hello.js", "zeta.js"]);

    // idempotent seeding does not clobber edits
    std::fs::write(dir.join("plugins/hello.js"), "// edited").unwrap();
    let _ = list_plugins(&ws).unwrap();
    assert_eq!(
      std::fs::read_to_string(dir.join("plugins/hello.js")).unwrap(),
      "// edited"
    );

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn plugin_read_rejects_unknown_workspace() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_plugins_val_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());
    ensure_plugins_dir(&dir.to_string_lossy());
    std::fs::write(dir.join("plugins/test.js"), "// ok").unwrap();

    assert!(plugin_list(app.clone(), dir.to_str().unwrap().to_string()).is_ok());

    let outside = std::env::temp_dir().join("nexus_plugin_outside");
    std::fs::create_dir_all(&outside).unwrap();
    assert!(plugin_list(app.clone(), outside.to_str().unwrap().to_string()).is_err());
    assert!(plugin_read(app, outside.to_str().unwrap().to_string(), "test.js".into()).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
  }

  #[test]
  fn reads_source_and_rejects_bad_names() {
    let dir = std::env::temp_dir().join(format!("nexus_plugins_read_{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    let ws = dir.to_string_lossy().to_string();
    ensure_plugins_dir(&ws);
    std::fs::write(dir.join("plugins/x.js"), "nx.log('hi')").unwrap();

    assert_eq!(read_plugin(&ws, "x.js").unwrap(), "nx.log('hi')");
    assert!(read_plugin(&ws, "../secret.txt").is_err());
    assert!(read_plugin(&ws, "").is_err());
    assert!(read_plugin(&ws, "sub/x.js").is_err());
    assert!(read_plugin(&ws, "missing.js").is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }
}
