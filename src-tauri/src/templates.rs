use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::workspace::{unique_path_public};

const TEMPLATES_DIR: &str = "07-Templates";

#[derive(Serialize)]
pub struct TemplateInfo {
  pub name: String,
  pub path: String,
}

pub fn render_template(content: &str, vars: &[(&str, &str)]) -> String {
  let mut out = content.to_string();
  for (key, value) in vars {
    out = out.replace(&format!("{{{{{}}}}}", key), value);
  }
  out
}

fn now_date() -> String {
  chrono::Local::now().format("%Y-%m-%d").to_string()
}

fn now_time() -> String {
  chrono::Local::now().format("%H:%M").to_string()
}

const DEFAULT_TEMPLATES: [(&str, &str); 3] = [
  (
    "daily.md",
    "---\ntitle: {{title}}\ntype: daily\ncreated: {{date}}\ntags:\n  - daily\n\n---\n\n# {{date}}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n",
  ),
  (
    "project.md",
    "---\ntitle: {{title}}\ntype: project\nstatus: active\ncreated: {{date}}\ntags:\n  - project\n\n---\n\n# {{title}}\n\n## Goal\n\n\n## Milestones\n\n- [ ] First milestone 📅 {{date}}\n\n## Notes\n\n",
  ),
  (
    "research.md",
    "---\ntitle: {{title}}\ntype: research\ncreated: {{date}}\ntags:\n  - research\n\n---\n\n# {{title}}\n\n## Question\n\n\n## Findings\n\n\n## Sources\n\n",
  ),
];

pub fn ensure_default_templates(workspace_path: &str) -> Result<(), String> {
  let dir = Path::new(workspace_path).join(TEMPLATES_DIR);
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  for (name, content) in DEFAULT_TEMPLATES {
    let path = dir.join(name);
    if !path.exists() {
      std::fs::write(&path, content).map_err(|e| e.to_string())?;
    }
  }
  Ok(())
}

fn templates_root(workspace_path: &str) -> Result<std::path::PathBuf, String> {
  let root = Path::new(workspace_path);
  if !root.is_dir() {
    return Err("Unknown workspace".into());
  }
  Ok(root.join(TEMPLATES_DIR))
}

fn sanitize_template_name(name: &str) -> Result<String, String> {
  let clean = name.trim();
  if clean.is_empty() || clean.contains("..") || clean.contains('/') || clean.contains('\\')
  {
    return Err("Invalid template name".into());
  }
  Ok(clean.to_string())
}

pub fn list_templates(workspace_path: &str) -> Result<Vec<TemplateInfo>, String> {
  let root = templates_root(workspace_path)?;
  ensure_default_templates(workspace_path)?;

  let rd = std::fs::read_dir(&root).map_err(|e| e.to_string())?;
  let mut out = Vec::new();
  for entry in rd.flatten() {
    let name = entry.file_name().to_string_lossy().to_string();
    let ext = Path::new(&name)
      .extension()
      .map(|e| e.to_string_lossy().to_lowercase())
      .unwrap_or_default();
    if ext != "md" && ext != "markdown" {
      continue;
    }
    out.push(TemplateInfo {
      name: name.clone(),
      path: entry.path().to_string_lossy().to_string(),
    });
  }
  out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
  Ok(out)
}

pub fn create_note_from_template(
  workspace_path: &str,
  template_name: &str,
  title: &str,
  parent_folder: Option<&str>,
) -> Result<String, String> {
  let clean_title = title.trim();
  if clean_title.is_empty() {
    return Err("Title is required".into());
  }
  let template_file = sanitize_template_name(template_name)?;
  let template_path = templates_root(workspace_path)?.join(&template_file);
  if !template_path.is_file() {
    return Err(format!("Template not found: {}", template_file));
  }
  let raw = std::fs::read_to_string(&template_path).map_err(|e| e.to_string())?;

  let content = render_template(
    &raw,
    &[
      ("title", clean_title),
      ("date", &now_date()),
      ("time", &now_time()),
    ],
  );

  let parent = match parent_folder {
    Some(folder) if !folder.trim().is_empty() => {
      let candidate = Path::new(workspace_path).join(folder.trim());
      if !candidate.is_dir() {
        return Err(format!("Target folder not found: {}", folder));
      }
      let canonical = candidate.canonicalize().map_err(|e| e.to_string())?;
      let ws_canonical = std::fs::canonicalize(workspace_path).map_err(|e| e.to_string())?;
      if !canonical.starts_with(&ws_canonical) {
        return Err("Parent folder is outside workspace".into());
      }
      candidate
    }
    _ => Path::new(workspace_path).join("00-Inbox"),
  };

  let base = if clean_title == "." || clean_title == ".." {
    "Untitled".to_string()
  } else {
    clean_title
      .chars()
      .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
      .collect::<String>()
      .trim()
      .to_string()
  };
  let base = if base.is_empty() { "Untitled".to_string() } else { base };
  let path = unique_path_public(&parent, &base, ".md");
  std::fs::write(&path, content).map_err(|e| e.to_string())?;
  Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn template_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<TemplateInfo>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let found: Option<i64> = conn
    .query_row(
      "SELECT id FROM workspaces WHERE path = ?1",
      rusqlite::params![workspace_path],
      |r| r.get(0),
    )
    .ok();
  if found.is_none() {
    return Err("Unknown workspace".into());
  }
  list_templates(&workspace_path)
}

#[tauri::command]
pub fn template_read<R: tauri::Runtime>(app: tauri::AppHandle<R>, path: String) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
  }
  std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn template_create_note<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  template_name: String,
  title: String,
  parent_folder: Option<String>,
) -> Result<String, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    let found: Option<i64> = conn
      .query_row(
        "SELECT id FROM workspaces WHERE path = ?1",
        rusqlite::params![workspace_path],
        |r| r.get(0),
      )
      .ok();
    if found.is_none() {
      return Err("Unknown workspace".into());
    }
  }
  let path = create_note_from_template(
    &workspace_path,
    &template_name,
    &title,
    parent_folder.as_deref(),
  )?;
  let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
  crate::workspace::note_write(app, path.clone(), content)?;
  Ok(path)
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
  fn renders_all_variables() {
    let out = render_template(
      "# {{title}}\ndate={{date}} time={{time}} ws={{title}}{{missing}}\n",
      &[("title", "My Note"), ("date", "2026-01-02"), ("time", "08:30")],
    );
    assert_eq!(out, "# My Note\ndate=2026-01-02 time=08:30 ws=My Note{{missing}}\n");
  }

  #[test]
  fn seeds_defaults_idempotently_and_lists_sorted() {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_tpl_seed_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();

    ensure_default_templates(dir.to_str().unwrap()).unwrap();
    // overwrite one to prove idempotence (no clobbering user edits)
    std::fs::write(dir.join("07-Templates/daily.md"), "# custom").unwrap();
    ensure_default_templates(dir.to_str().unwrap()).unwrap();
    assert_eq!(std::fs::read_to_string(dir.join("07-Templates/daily.md")).unwrap(), "# custom");

    let list = list_templates(dir.to_str().unwrap()).unwrap();
    let names: Vec<&str> = list.iter().map(|t| t.name.as_str()).collect();
    assert_eq!(names, vec!["daily.md", "project.md", "research.md"]);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn creates_note_with_substitution_and_collision_suffix() {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_tpl_create_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("07-Templates")).unwrap();
    std::fs::create_dir_all(dir.join("00-Inbox")).unwrap();
    std::fs::write(
      dir.join("07-Templates/project.md"),
      "---\ntitle: {{title}}\n---\n\n# {{title}}\ncreated {{date}} at {{time}}\n",
    )
    .unwrap();

    let p1 =
      create_note_from_template(dir.to_str().unwrap(), "project.md", "Site Redesign", None)
        .unwrap();
    assert!(p1.ends_with("Site Redesign.md"));
    let c1 = std::fs::read_to_string(&p1).unwrap();
    assert!(c1.contains("title: Site Redesign"));
    assert!(c1.contains("# Site Redesign"));
    assert!(!c1.contains("{{title}}"));
    assert!(c1.contains("created 2"));

    let p2 =
      create_note_from_template(dir.to_str().unwrap(), "project.md", "Site Redesign", None)
        .unwrap();
    assert!(p2.ends_with("Site Redesign 2.md"));

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn template_create_note_rejects_unknown_workspace() {
    let app = mock_app();
    let dir =
      std::env::temp_dir().join(format!("nexus_test_tpl_ws_val_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("07-Templates")).unwrap();
    std::fs::create_dir_all(dir.join("00-Inbox")).unwrap();
    std::fs::write(
      dir.join("07-Templates/daily.md"),
      "---\ntitle: {{title}}\n---\n\n# {{title}}\n",
    )
    .unwrap();
    register_ws(&app, &dir.to_string_lossy());

    assert!(template_create_note(
      app.clone(),
      dir.to_str().unwrap().to_string(),
      "daily.md".into(),
      "Test Note".into(),
      None,
    )
    .is_ok());

    let outside = std::env::temp_dir().join("nexus_tpl_outside");
    std::fs::create_dir_all(&outside).unwrap();
    assert!(template_create_note(
      app,
      outside.to_str().unwrap().to_string(),
      "daily.md".into(),
      "Bad Note".into(),
      None,
    )
    .is_err());

    std::fs::remove_dir_all(&dir).unwrap();
    std::fs::remove_dir_all(&outside).unwrap();
  }

  #[test]
  fn rejects_bad_template_names_titles_and_missing_targets() {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_tpl_reject_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("07-Templates")).unwrap();
    std::fs::write(dir.join("07-Templates/daily.md"), "# d").unwrap();
    let wsp = dir.to_str().unwrap();

    assert!(create_note_from_template(wsp, "../secret.md", "T", None).is_err());
    assert!(create_note_from_template(wsp, "missing.md", "T", None).is_err());
    assert!(create_note_from_template(wsp, "daily.md", "   ", None).is_err());
    assert!(create_note_from_template(wsp, "daily.md", "T", Some("No/Such/Folder")).is_err());
    assert!(create_note_from_template(wsp, "daily.md", "Escape", Some("../..")).is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }
}
