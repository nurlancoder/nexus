use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::linking::note_title;

#[derive(Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct DatabaseDefinition {
  pub source_folders: Vec<String>,
  pub filter_key: Option<String>,
  pub filter_value: Option<String>,
  pub columns: Vec<String>,
  pub sort_key: Option<String>,
  pub sort_dir: Option<String>,
}

impl Default for DatabaseDefinition {
  fn default() -> Self {
    Self {
      source_folders: Vec::new(),
      filter_key: None,
      filter_value: None,
      columns: Vec::new(),
      sort_key: None,
      sort_dir: Some("asc".into()),
    }
  }
}

#[derive(Serialize)]
pub struct DatabaseMeta {
  pub id: i64,
  pub name: String,
  pub definition: DatabaseDefinition,
}

#[derive(Serialize)]
pub struct DatabaseRow {
  pub path: String,
  pub title: String,
  pub properties: HashMap<String, String>,
}

pub fn parse_frontmatter_map(content: &str) -> Vec<(String, String)> {
  let mut out: Vec<(String, String)> = Vec::new();
  let mut lines = content.lines();
  let mut started = false;
  for line in lines.by_ref() {
    let t = line.trim();
    if t == "---" {
      started = true;
      break;
    }
    if !t.is_empty() {
      return out;
    }
  }
  if !started {
    return out;
  }

  let mut pending: Option<String> = None;
  let mut block: Vec<String> = Vec::new();

  let flush = |pending: &mut Option<String>, block: &mut Vec<String>, out: &mut Vec<(String, String)>| {
    if let Some(key) = pending.take() {
      let value = if block.is_empty() {
        String::new()
      } else {
        block.join(", ")
      };
      out.push((key, value));
      block.clear();
    }
  };

  for line in lines {
    if line.trim() == "---" {
      break;
    }
    let t = line.trim();
    if t.is_empty() {
      continue;
    }
    if line.starts_with(' ') || line.starts_with('\t') {
      if pending.is_some() {
        if let Some(item) = t.strip_prefix("- ") {
          block.push(item.trim().trim_matches('"').trim_matches('\'').to_string());
        }
      }
      continue;
    }
    flush(&mut pending, &mut block, &mut out);
    if let Some(sep) = t.find(':') {
      let key = t[..sep].trim().to_string();
      let rest = t[sep + 1..].trim();
      if rest.is_empty() {
        pending = Some(key);
      } else if rest.starts_with('[') && rest.ends_with(']') && rest.len() >= 2 {
        let inner = &rest[1..rest.len() - 1];
        let items: Vec<String> = inner
          .split(',')
          .map(|p| p.trim().trim_matches('"').trim_matches('\'').to_string())
          .filter(|p| !p.is_empty())
          .collect();
        out.push((key, items.join(", ")));
      } else {
        out.push((key, rest.trim_matches('"').trim_matches('\'').to_string()));
      }
    }
  }
  flush(&mut pending, &mut block, &mut out);
  out
}

fn collect_rows(root: &Path, source_folders: &[String]) -> Result<Vec<DatabaseRow>, String> {
  let nodes = crate::workspace::scan_dir_public(root)?;
  let mut flat = Vec::new();
  crate::workspace::flatten_public(&nodes, &mut flat);

  let mut rows = Vec::new();
  for n in flat {
    if n.is_dir {
      continue;
    }
    if !crate::util::is_text_file(&n.name) {
      continue;
    }
    if !source_folders.is_empty() {
      let rel = Path::new(&n.path)
        .strip_prefix(root)
        .unwrap_or(Path::new(&n.path))
        .to_string_lossy()
        .replace('\\', "/");
      let matched = source_folders
        .iter()
        .any(|f| rel == *f || rel.starts_with(&format!("{f}/")));
      if !matched {
        continue;
      }
    }
    let content = match std::fs::read_to_string(&n.path) {
      Ok(c) => c,
      Err(_) => continue,
    };
    let properties: HashMap<String, String> = parse_frontmatter_map(&content).into_iter().collect();
    rows.push(DatabaseRow {
      path: n.path.clone(),
      title: note_title(&content, &n.path),
      properties,
    });
  }
  Ok(rows)
}

#[tauri::command]
pub fn database_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<DatabaseMeta>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let ws_id = crate::util::resolve_workspace_id(&conn, &workspace_path)?;
  let mut stmt = conn
    .prepare("SELECT id, name, definition FROM databases WHERE workspace_id = ?1 ORDER BY name")
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map(params![ws_id], |r| {
      Ok((
        r.get::<_, i64>(0)?,
        r.get::<_, String>(1)?,
        r.get::<_, String>(2)?,
      ))
    })
    .map_err(|e| e.to_string())?;
  let mut out = Vec::new();
  for row in rows {
    let (id, name, raw) = row.map_err(|e| e.to_string())?;
    let definition = serde_json::from_str::<DatabaseDefinition>(&raw).unwrap_or_default();
    out.push(DatabaseMeta { id, name, definition });
  }
  Ok(out)
}

#[tauri::command]
pub fn database_save<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  name: String,
  definition: DatabaseDefinition,
) -> Result<(), String> {
  if name.trim().is_empty() {
    return Err("Database name must not be empty".into());
  }
  let db = app.state::<Database>();
  let conn = db.conn();
  let ws_id = crate::util::resolve_workspace_id(&conn, &workspace_path)?;
  let json = serde_json::to_string(&definition).map_err(|e| e.to_string())?;
  conn
    .execute(
      "INSERT INTO databases (workspace_id, name, definition)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(workspace_id, name) DO UPDATE SET
         definition = excluded.definition,
         updated_at = datetime('now')",
      params![ws_id, name.trim(), json],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn database_delete<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  name: String,
) -> Result<(), String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let ws_id = crate::util::resolve_workspace_id(&conn, &workspace_path)?;
  conn
    .execute(
      "DELETE FROM databases WHERE workspace_id = ?1 AND name = ?2",
      params![ws_id, name],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub fn database_rows<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  source_folders: Vec<String>,
) -> Result<Vec<DatabaseRow>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  crate::util::resolve_workspace_id(&conn, &workspace_path)?;
  collect_rows(Path::new(&workspace_path), &source_folders)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_frontmatter_map_with_inline_block_quoted_and_nested_skip() {
    let content = "---\ntitle: \"My Note\"\nstatus: active\npriority: 3\ntags: [a, b]\naliases:\n  - Foo\n  - Bar\nnested:\n  key: value\n---\n# Body";
    let map: HashMap<String, String> = parse_frontmatter_map(content).into_iter().collect();
    assert_eq!(map.get("title").unwrap(), "My Note");
    assert_eq!(map.get("status").unwrap(), "active");
    assert_eq!(map.get("priority").unwrap(), "3");
    assert_eq!(map.get("tags").unwrap(), "a, b");
    assert_eq!(map.get("aliases").unwrap(), "Foo, Bar");
    assert!(!map.contains_key("key"));
  }

  #[test]
  fn returns_empty_without_frontmatter() {
    assert!(parse_frontmatter_map("no frontmatter here").is_empty());
    assert!(parse_frontmatter_map("").is_empty());
  }

  #[test]
  fn collect_rows_filters_by_folder_and_reads_properties() {
    let dir = std::env::temp_dir().join(format!("nexus_test_dbrows_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("01-Notes")).unwrap();
    std::fs::create_dir_all(dir.join("02-Projects")).unwrap();
    std::fs::write(
      dir.join("01-Notes/A.md"),
      "---\nstatus: active\n---\n# A",
    )
    .unwrap();
    std::fs::write(
      dir.join("02-Projects/B.md"),
      "---\nstatus: planning\nprogress: 60\n---\n# B",
    )
    .unwrap();

    let all = collect_rows(&dir, &[]).unwrap();
    assert_eq!(all.len(), 2);

    let notes = collect_rows(&dir, &["01-Notes".to_string()]).unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].title, "A");
    assert_eq!(notes[0].properties.get("status").unwrap(), "active");

    let none = collect_rows(&dir, &["05-Archive".to_string()]).unwrap();
    assert!(none.is_empty());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  fn setup_app() -> tauri::AppHandle<tauri::test::MockRuntime> {
    let app = crate::test_helpers::mock_app();
    crate::test_helpers::register_ws(&app, "WS");
    app
  }

  #[test]
  fn save_list_delete_roundtrip() {
    let app = setup_app();

    let def = DatabaseDefinition {
      source_folders: vec!["01-Notes".into()],
      filter_key: Some("status".into()),
      filter_value: Some("active".into()),
      columns: vec!["status".into(), "tags".into()],
      sort_key: Some("title".into()),
      sort_dir: Some("desc".into()),
    };

    database_save(app.clone(), "WS".into(), "Projects".into(), def.clone()).unwrap();
    database_save(app.clone(), "WS".into(), "Archive".into(), DatabaseDefinition::default()).unwrap();

    let list = database_list(app.clone(), "WS".into()).unwrap();
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].name, "Archive");
    let projects = list.iter().find(|m| m.name == "Projects").unwrap();
    assert_eq!(projects.definition.source_folders, vec!["01-Notes"]);
    assert_eq!(projects.definition.filter_key.as_deref(), Some("status"));
    assert_eq!(projects.definition.sort_dir.as_deref(), Some("desc"));

    database_save(app.clone(), "WS".into(), "Projects".into(), DatabaseDefinition::default()).unwrap();
    let list = database_list(app.clone(), "WS".into()).unwrap();
    assert!(list.iter().find(|m| m.name == "Projects").unwrap().definition.filter_key.is_none());

    database_delete(app.clone(), "WS".into(), "Archive".into()).unwrap();
    let list = database_list(app, "WS".into()).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].name, "Projects");
  }

  #[test]
  fn rejects_empty_database_name() {
    let app = setup_app();
    assert!(database_save(app, "WS".into(), "   ".into(), DatabaseDefinition::default()).is_err());
  }

  #[test]
  fn database_rows_rejects_unknown_workspace() {
    let app = setup_app();
    assert!(database_rows(app, "UNKNOWN".into(), vec![]).is_err());
  }
}
