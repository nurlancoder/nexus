use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;

#[derive(Serialize)]
pub struct SearchResult {
  pub path: String,
  pub title: String,
  pub snippet: String,
}

pub fn extract_title(content: &str, fallback: &str) -> String {
  for line in content.lines() {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("title:") {
      let t = rest.trim().trim_matches('"').trim_matches('\'');
      if !t.is_empty() {
        return t.to_string();
      }
    }
  }
  for line in content.lines() {
    let line = line.trim();
    if let Some(rest) = line.strip_prefix("# ") {
      return rest.trim().to_string();
    }
  }
  fallback
    .trim_end_matches(".md")
    .trim_end_matches(".markdown")
    .trim_end_matches(".txt")
    .to_string()
}

pub fn index_note(conn: &Connection, workspace_id: i64, path: &str) -> Result<(), String> {
  let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
  let title = extract_title(&content, Path::new(path).file_name().unwrap_or_default().to_str().unwrap_or(path));
  // UPSERT is not implemented for virtual tables (fts5), so replace explicitly.
  conn
    .execute("DELETE FROM note_index WHERE path = ?1", params![path])
    .map_err(|e| e.to_string())?;
  conn.execute(
    "INSERT INTO note_index (title, content, path, workspace_id)
     VALUES (?1, ?2, ?3, ?4)",
    params![title, content, path, workspace_id],
  )
  .map_err(|e| e.to_string())?;
  Ok(())
}

pub fn remove_note(conn: &Connection, path: &str) -> Result<(), String> {
  conn
    .execute("DELETE FROM note_index WHERE path = ?1", params![path])
    .map_err(|e| e.to_string())?;
  Ok(())
}

pub fn find_workspace_id(conn: &Connection, path: &Path) -> Result<i64, String> {
  conn
    .query_row(
      "SELECT id FROM workspaces WHERE path = ?1",
      params![path.to_string_lossy()],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Resolves a workspace for an arbitrary path inside it (longest prefix wins).
pub fn find_workspace_id_for_path(conn: &Connection, path: &str) -> Result<i64, String> {
  conn
    .query_row(
      "SELECT id FROM workspaces
       WHERE ?1 LIKE path || '/%' OR path = ?1
       ORDER BY LENGTH(path) DESC LIMIT 1",
      params![path],
      |r| r.get(0),
    )
    .map_err(|_| "Unknown workspace".to_string())
}

pub fn reindex_workspace(app: &tauri::AppHandle, root: &Path) -> Result<usize, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let workspace_id = find_workspace_id(&conn, root)?;

  conn
    .execute(
      "DELETE FROM note_index WHERE workspace_id = ?1",
      params![workspace_id],
    )
    .map_err(|e| e.to_string())?;

  let mut count = 0;
  let nodes = crate::workspace::scan_dir_public(root)?;
  let mut flat = Vec::new();
  crate::workspace::flatten_public(&nodes, &mut flat);
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
    index_note(&conn, workspace_id, &n.path)?;
    count += 1;
  }
  Ok(count)
}

fn escape_query(input: &str) -> String {
  let mut out = String::new();
  for c in input.chars() {
    if matches!(c, '"' | '\'' | '*' | ':' | '^' | '(' | ')' | '-' | '~' | '\\') {
      out.push(' ');
    } else {
      out.push(c);
    }
  }
  out
}

pub fn build_fts_query(input: &str) -> String {
  let terms: Vec<String> = escape_query(input)
    .split_whitespace()
    .map(|t| format!("{t}*"))
    .collect();
  if terms.is_empty() {
    String::new()
  } else {
    terms.join(" ")
  }
}

pub fn search(
  app: &tauri::AppHandle,
  root: &Path,
  query: &str,
  limit: usize,
) -> Result<Vec<SearchResult>, String> {
  let fts = build_fts_query(query);
  if fts.is_empty() {
    return Ok(Vec::new());
  }
  let db = app.state::<Database>();
  let conn = db.conn();
  let workspace_id = find_workspace_id(&conn, root)?;

  let sql = format!(
    "SELECT path, title, snippet(note_index, 1, '\x01', '\x02', ' … ', 12)
     FROM note_index
     WHERE note_index MATCH ?1 AND workspace_id = ?2
     ORDER BY rank
     LIMIT ?3"
  );

  let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map(params![fts, workspace_id, limit as i64], |r| {
      Ok(SearchResult {
        path: r.get(0)?,
        title: r.get(1)?,
        snippet: r.get(2)?,
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
pub fn search_query(
  app: tauri::AppHandle,
  workspace_path: String,
  query: String,
  limit: Option<usize>,
) -> Result<Vec<SearchResult>, String> {
  search(&app, Path::new(&workspace_path), &query, limit.unwrap_or(50))
}

#[tauri::command]
pub fn search_reindex(app: tauri::AppHandle, workspace_path: String) -> Result<usize, String> {
  reindex_workspace(&app, Path::new(&workspace_path))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn extract_title_uses_frontmatter_then_h1_then_name() {
    assert_eq!(
      extract_title("---\ntitle: My Title\n---\n# H1", "note.md"),
      "My Title"
    );
    assert_eq!(extract_title("# H1 only", "note.md"), "H1 only");
    assert_eq!(extract_title("plain", "my-note.md"), "my-note");
  }

  #[test]
  fn build_fts_query_prefixes_and_escapes() {
    assert_eq!(build_fts_query("react hooks"), "react* hooks*");
    assert_eq!(build_fts_query("alpha:beta"), "alpha* beta*");
    assert_eq!(build_fts_query("  "), "");
  }

  #[test]
  fn escape_query_removes_operators() {
    assert_eq!(escape_query("a-b ~c"), "a b  c");
  }
}