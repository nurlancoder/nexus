use rusqlite::params;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::linking::{frontmatter_value, note_title, parse_wiki_links};

#[derive(Serialize)]
pub struct GraphNode {
  pub path: String,
  pub title: String,
  pub tags: Vec<String>,
  pub links: Vec<String>,
}

pub(crate) fn extract_tags(content: &str) -> Vec<String> {
  let mut tags = std::collections::BTreeSet::new();
  for line in content.lines() {
    let mut rest = line;
    while let Some(start) = rest.find('#') {
      let after = &rest[start + 1..];
      let end = after
        .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
        .unwrap_or(after.len());
      let tag = &after[..end];
      if !tag.is_empty() {
        tags.insert(tag.to_string());
      }
      rest = &after[end.min(after.len())..];
    }
  }
  tags.into_iter().collect()
}

pub(crate) fn build_index(nodes: &[GraphNode]) -> HashMap<String, String> {
  let mut index: HashMap<String, String> = HashMap::new();
  for n in nodes {
    let lower_title = n.title.to_lowercase();
    index.insert(lower_title.clone(), n.path.clone());
    let stem = Path::new(&n.path)
      .file_stem()
      .map(|s| s.to_string_lossy().to_lowercase())
      .unwrap_or_default();
    if !stem.is_empty() {
      index.entry(stem).or_insert_with(|| n.path.clone());
    }
    let content = std::fs::read_to_string(&n.path).unwrap_or_default();
    for alias in frontmatter_value(&content, "aliases") {
      index
        .entry(alias.to_lowercase())
        .or_insert_with(|| n.path.clone());
    }
  }
  index
}

pub(crate) fn resolve_link(target: &str, index: &HashMap<String, String>) -> Option<String> {
  let t = target.trim().to_lowercase();
  let base = t.rsplit('/').next().unwrap_or(&t).to_string();
  let base = base.trim_end_matches(".md").to_string();
  index.get(&base).cloned().or_else(|| index.get(&t).cloned())
}

pub fn graph(app: &tauri::AppHandle, workspace_path: &str) -> Result<Vec<GraphNode>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let ws_id = crate::util::resolve_workspace_id(&conn, workspace_path)?;

  let mut stmt = conn
    .prepare("SELECT path, title FROM files WHERE workspace_id = ?1 AND type = 'note'")
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map(params![ws_id], |r| {
      Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
    })
    .map_err(|e| e.to_string())?;

  let mut raw = Vec::new();
  for row in rows {
    let (path, _title) = row.map_err(|e| e.to_string())?;
    let content = match std::fs::read_to_string(&path) {
      Ok(c) => c,
      Err(_) => continue,
    };
    let t = note_title(&content, &path);
    raw.push(GraphNode {
      path,
      title: t,
      tags: extract_tags(&content),
      links: Vec::new(),
    });
  }

  let index = build_index(&raw);
  for n in raw.iter_mut() {
    let content = match std::fs::read_to_string(&n.path) {
      Ok(c) => c,
      Err(_) => continue,
    };
    let mut seen = std::collections::BTreeSet::new();
    for (target, embed) in parse_wiki_links(&content) {
      if embed {
        continue;
      }
      if let Some(path) = resolve_link(&target, &index) {
        if path != n.path && seen.insert(path.clone()) {
          n.links.push(path);
        }
      }
    }
  }

  raw.sort_by_key(|a| a.title.to_lowercase());
  Ok(raw)
}

#[tauri::command]
pub fn linking_graph(
  app: tauri::AppHandle,
  workspace_path: String,
) -> Result<Vec<GraphNode>, String> {
  graph(&app, &workspace_path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn extracts_tags_from_body_and_frontmatter() {
    let content = "# A\nSome #react text and #frontend_ui\n";
    let tags = extract_tags(content);
    assert!(tags.contains(&"react".to_string()));
    assert!(tags.contains(&"frontend_ui".to_string()));
    assert_eq!(tags.len(), 2);
  }

  #[test]
  fn build_index_maps_title_and_stem() {
    let nodes = vec![
      GraphNode {
        path: "/w/01-Notes/React.md".into(),
        title: "React Framework".into(),
        tags: vec![],
        links: vec![],
      },
    ];
    let index = build_index(&nodes);
    assert_eq!(index.get("react framework"), Some(&"/w/01-Notes/React.md".to_string()));
    assert_eq!(index.get("react"), Some(&"/w/01-Notes/React.md".to_string()));
  }

  #[test]
  fn resolve_link_handles_path_suffix_and_md() {
    let mut index = HashMap::new();
    index.insert("react".to_string(), "/w/a.md".to_string());
    assert_eq!(resolve_link("notes/React.md", &index), Some("/w/a.md".to_string()));
    assert_eq!(resolve_link("React", &index), Some("/w/a.md".to_string()));
    assert_eq!(resolve_link("Missing", &index), None);
  }
}