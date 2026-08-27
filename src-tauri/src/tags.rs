use rusqlite::params;
use serde::Serialize;
use std::collections::BTreeMap;
use tauri::Manager;

use crate::db::Database;

#[derive(Serialize)]
pub struct TagCount {
  pub tag: String,
  pub count: usize,
}

#[derive(Serialize)]
pub struct TagNote {
  pub path: String,
  pub title: String,
  pub snippet: String,
}

fn collect_tags(content: &str) -> Vec<String> {
  let mut set = std::collections::BTreeSet::new();
  for t in crate::graph::extract_tags(content) {
    set.insert(t);
  }
  for t in crate::linking::frontmatter_value(content, "tags") {
    let cleaned = t.trim().trim_start_matches('#').trim();
    if !cleaned.is_empty() {
      set.insert(cleaned.to_string());
    }
  }
  set.into_iter().collect()
}

fn note_has_tag(content: &str, tag: &str) -> bool {
  let needle = tag.trim().to_lowercase();
  if needle.is_empty() {
    return false;
  }
  collect_tags(content).iter().any(|t| t.to_lowercase() == needle)
}

fn build_snippet(content: &str, tag: &str) -> String {
  let needle = tag.trim().to_lowercase();
  let lower = content.to_lowercase();
  if let Some(idx) = lower.find(&needle) {
    crate::linking::make_snippet(content, idx, needle.len())
  } else {
    String::new()
  }
}

fn scan_notes<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  workspace_path: &str,
) -> Result<Vec<(String, String, String)>, String> {
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
  let mut out = Vec::new();
  for row in rows {
    let (path, title) = row.map_err(|e| e.to_string())?;
    if let Ok(content) = std::fs::read_to_string(&path) {
      out.push((path, title, content));
    }
  }
  Ok(out)
}

#[tauri::command]
pub fn tags_list<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<TagCount>, String> {
  let notes = scan_notes(&app, &workspace_path)?;
  let mut counts: BTreeMap<String, usize> = BTreeMap::new();
  for (_path, _title, content) in &notes {
    for t in collect_tags(content) {
      *counts.entry(t).or_insert(0) += 1;
    }
  }
  let mut out: Vec<TagCount> = counts
    .into_iter()
    .map(|(tag, count)| TagCount { tag, count })
    .collect();
  out.sort_by(|a, b| b.count.cmp(&a.count).then(a.tag.cmp(&b.tag)));
  Ok(out)
}

#[tauri::command]
pub fn tags_notes<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  tag: String,
) -> Result<Vec<TagNote>, String> {
  let notes = scan_notes(&app, &workspace_path)?;
  let mut out = Vec::new();
  for (path, title, content) in notes {
    if note_has_tag(&content, &tag) {
      out.push(TagNote {
        path,
        title,
        snippet: build_snippet(&content, &tag),
      });
    }
  }
  out.sort_by_key(|a| a.title.to_lowercase());
  Ok(out)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::sync::atomic::{AtomicUsize, Ordering};

  static COUNTER: AtomicUsize = AtomicUsize::new(0);

  fn setup_notes() -> (tauri::AppHandle<tauri::test::MockRuntime>, std::path::PathBuf) {
    let n = COUNTER.fetch_add(1, Ordering::SeqCst);
    let app = crate::test_helpers::mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_tags_{}_{}", std::process::id(), n));
    std::fs::create_dir_all(&dir).unwrap();
    crate::test_helpers::register_ws(&app, &dir.to_string_lossy());

    std::fs::write(dir.join("A.md"), "# A\n\nSome #work and #urgent notes.").unwrap();
    std::fs::write(dir.join("B.md"), "---\ntags: [work, project]\n---\n# B\nbody").unwrap();
    std::fs::write(dir.join("C.md"), "# C\n\nJust #work here.").unwrap();
    std::fs::write(dir.join("D.md"), "---\ntags: [urgent]\n---\n# D\nbody").unwrap();

    {
      let db = app.state::<Database>();
      let conn = db.conn();
      let ws_id: i64 = conn
        .query_row(
          "SELECT id FROM workspaces WHERE path = ?1",
          rusqlite::params![dir.to_string_lossy()],
          |r| r.get(0),
        )
        .unwrap();
      for (name, title) in [("A.md", "A"), ("B.md", "B"), ("C.md", "C"), ("D.md", "D")] {
        conn
          .execute(
            "INSERT INTO files (workspace_id, path, title, type) VALUES (?1, ?2, ?3, 'note')",
            rusqlite::params![ws_id, dir.join(name).to_string_lossy(), title],
          )
          .unwrap();
      }
    }
    (app, dir)
  }

  #[test]
  fn collect_tags_merges_body_and_frontmatter() {
    assert_eq!(
      collect_tags("---\ntags: [work, project]\n---\n# H\nSome #work text"),
      vec!["project".to_string(), "work".to_string()]
    );
  }

  #[test]
  fn tags_list_aggregates_frequencies_desc() {
    let (app, dir) = setup_notes();
    let list = tags_list(app, dir.to_string_lossy().to_string()).unwrap();
    let map: Vec<(String, usize)> = list.into_iter().map(|t| (t.tag, t.count)).collect();
    assert_eq!(map[0], ("work".to_string(), 3));
    assert_eq!(map[1], ("urgent".to_string(), 2));
    assert_eq!(map[2], ("project".to_string(), 1));
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn tags_notes_returns_only_notes_with_the_tag() {
    let (app, dir) = setup_notes();
    let notes = tags_notes(app, dir.to_string_lossy().to_string(), "urgent".to_string()).unwrap();
    let paths: Vec<String> = notes.iter().map(|n| n.path.clone()).collect();
    assert_eq!(paths.len(), 2);
    assert!(paths.iter().any(|p| p.ends_with("A.md")));
    assert!(paths.iter().any(|p| p.ends_with("D.md")));
    for n in &notes {
      assert!(!n.snippet.is_empty());
    }
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn note_has_tag_matches_case_insensitively_and_frontmatter() {
    let content = "---\ntags: [Work]\n---\n# H\nbody";
    assert!(note_has_tag(content, "work"));
    assert!(note_has_tag(content, "Work"));
    assert!(!note_has_tag(content, "nope"));
  }
}
