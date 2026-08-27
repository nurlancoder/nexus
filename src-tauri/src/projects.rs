use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::linking::note_title;
use crate::tasks::{collect_tasks, Task};
use crate::workspace::{flatten_public, scan_dir_public};

const PROJECTS_DIR: &str = "02-Projects";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
  pub name: String,
  pub path: String,
  pub note_count: usize,
  pub open_tasks: usize,
  pub done_tasks: usize,
  pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectNote {
  pub path: String,
  pub title: String,
  pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectResource {
  pub path: String,
  pub name: String,
  pub size: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetail {
  pub name: String,
  pub path: String,
  pub notes: Vec<ProjectNote>,
  pub tasks: Vec<Task>,
  pub resources: Vec<ProjectResource>,
}

fn fmt_modified(meta: &std::fs::Metadata) -> String {
  meta
    .modified()
    .ok()
    .map(|t| {
      let dt: chrono::DateTime<chrono::Local> = t.into();
      dt.format("%Y-%m-%d %H:%M").to_string()
    })
    .unwrap_or_default()
}

fn projects_root(workspace_path: &str) -> Result<std::path::PathBuf, String> {
  let root = Path::new(workspace_path);
  if !root.is_dir() {
    return Err("Unknown workspace".into());
  }
  Ok(root.join(PROJECTS_DIR))
}

pub fn list_projects(workspace_path: &str) -> Result<Vec<ProjectSummary>, String> {
  let root = projects_root(workspace_path)?;
  if !root.is_dir() {
    return Ok(Vec::new());
  }

  let mut out = Vec::new();
  let rd = std::fs::read_dir(&root).map_err(|e| e.to_string())?;
  for entry in rd.flatten() {
    if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
      continue;
    }
    let name = entry.file_name().to_string_lossy().to_string();
    if name.starts_with('.') {
      continue;
    }
    let dir = entry.path();

    let mut note_count = 0usize;
    let mut latest: Option<String> = None;
    let nodes = scan_dir_public(&dir)?;
    let mut flat = Vec::new();
    flatten_public(&nodes, &mut flat);
    for n in flat {
      if n.is_dir || !crate::util::is_note(&n.name) {
        continue;
      }
      note_count += 1;
      if let Ok(meta) = std::fs::metadata(&n.path) {
        let m = fmt_modified(&meta);
        if latest.as_deref().unwrap_or("") < m.as_str() {
          latest = Some(m);
        }
      }
    }

    let tasks = collect_tasks(&dir).unwrap_or_default();
    let open_tasks = tasks.iter().filter(|t| !t.done).count();
    let done_tasks = tasks.iter().filter(|t| t.done).count();

    out.push(ProjectSummary {
      name,
      path: dir.to_string_lossy().to_string(),
      note_count,
      open_tasks,
      done_tasks,
      updated_at: latest.unwrap_or_default(),
    });
  }
  out.sort_by_key(|a| a.name.to_lowercase());
  Ok(out)
}

pub fn project_detail(
  workspace_path: &str,
  name: &str,
) -> Result<ProjectDetail, String> {
  let root = projects_root(workspace_path)?;
  let clean = name.trim();
  if clean.is_empty() || clean.contains("..") || clean.contains('/') || clean.contains('\\')
  {
    return Err("Invalid project name".into());
  }
  let dir = root.join(clean);
  if !dir.is_dir() {
    return Err(format!("Project not found: {}", clean));
  }

  let nodes = scan_dir_public(&dir)?;
  let mut flat = Vec::new();
  flatten_public(&nodes, &mut flat);

  let mut notes = Vec::new();
  let mut resources = Vec::new();
  for n in flat {
    if n.is_dir {
      continue;
    }
    if crate::util::is_note(&n.name) {
      let content = std::fs::read_to_string(&n.path).unwrap_or_default();
      let title = note_title(&content, &n.path);
      let updated_at = std::fs::metadata(&n.path)
        .map(|m| fmt_modified(&m))
        .unwrap_or_default();
      notes.push(ProjectNote {
        path: n.path.clone(),
        title,
        updated_at,
      });
    } else {
      let size = std::fs::metadata(&n.path).map(|m| m.len()).unwrap_or(0);
      resources.push(ProjectResource {
        path: n.path.clone(),
        name: n.name.clone(),
        size,
      });
    }
  }
  notes.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
  resources.sort_by_key(|a| a.name.to_lowercase());

  let tasks = collect_tasks(&dir).unwrap_or_default();

  Ok(ProjectDetail {
    name: clean.to_string(),
    path: dir.to_string_lossy().to_string(),
    notes,
    tasks,
    resources,
  })
}

#[tauri::command]
pub fn project_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<ProjectSummary>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  crate::util::resolve_workspace_id(&conn, &workspace_path)?;
  list_projects(&workspace_path)
}

#[tauri::command]
pub fn project_detail_cmd<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  name: String,
) -> Result<ProjectDetail, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  crate::util::resolve_workspace_id(&conn, &workspace_path)?;
  project_detail(&workspace_path, &name)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn setup_ws(label: &str) -> std::path::PathBuf {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_proj_{label}_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("02-Projects/Alpha/sub")).unwrap();
    std::fs::write(
      dir.join("02-Projects/Alpha/plan.md"),
      "# Plan\n\n- [ ] design ⏫\n- [x] kickoff\n",
    )
    .unwrap();
    std::fs::write(dir.join("02-Projects/Alpha/sub/research.md"), "# Research\n").unwrap();
    std::fs::write(dir.join("02-Projects/Alpha/spec.pdf"), "%PDF").unwrap();
    std::fs::write(dir.join("02-Projects/loose-note.md"), "# Loose\n").unwrap();
    dir
  }

  #[test]
  fn lists_project_folders_with_counts() {
    let ws = setup_ws("list");
    let projects = list_projects(ws.to_str().unwrap()).unwrap();
    assert_eq!(projects.len(), 1);
    let p = &projects[0];
    assert_eq!(p.name, "Alpha");
    assert_eq!(p.note_count, 2);
    assert_eq!(p.open_tasks, 1);
    assert_eq!(p.done_tasks, 1);
    assert!(!p.updated_at.is_empty());
    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn detail_returns_notes_tasks_resources() {
    let ws = setup_ws("detail");
    let d = project_detail(ws.to_str().unwrap(), "Alpha").unwrap();
    assert_eq!(d.notes.len(), 2);
    assert!(d.notes.iter().any(|n| n.title == "Plan"));
    assert_eq!(d.tasks.len(), 2);
    assert_eq!(d.resources.len(), 1);
    assert_eq!(d.resources[0].name, "spec.pdf");
    // notes sorted by updated desc — both fresh, just ensure sorted field present
    assert!(!d.notes[0].updated_at.is_empty());
    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn detail_rejects_missing_or_invalid_names() {
    let ws = setup_ws("rejects");
    assert!(project_detail(ws.to_str().unwrap(), "Missing").is_err());
    assert!(project_detail(ws.to_str().unwrap(), "../etc").is_err());
    assert!(project_detail(ws.to_str().unwrap(), "").is_err());
    std::fs::remove_dir_all(&ws).unwrap();
  }

  #[test]
  fn empty_projects_folder_returns_empty_list() {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_proj_empty_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("02-Projects")).unwrap();
    let out = list_projects(dir.to_str().unwrap()).unwrap();
    assert!(out.is_empty());
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
