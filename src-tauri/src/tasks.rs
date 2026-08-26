use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::linking::note_title;
use crate::workspace::{flatten_public, scan_dir_public};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
  pub path: String,
  pub note_title: String,
  pub folder: String,
  pub line: usize,
  pub text: String,
  pub done: bool,
  pub due: Option<String>,
  pub priority: Option<String>,
  pub tags: Vec<String>,
}

fn is_checkbox_line(trimmed: &str) -> Option<(bool, &str)> {
  let mut chars = trimmed.chars();
  match chars.next()? {
    '-' | '*' | '+' => {}
    _ => return None,
  }
  if chars.next()? != ' ' {
    return None;
  }
  let rest = &trimmed[2..];
  let mut r = rest.chars();
  if r.next()? != '[' {
    return None;
  }
  let state = r.next()?;
  if r.next()? != ']' {
    return None;
  }
  let after = &rest[3..];
  let done = matches!(state, 'x' | 'X');
  let text = after.strip_prefix(' ').unwrap_or(after);
  Some((done, text))
}

fn body_after_frontmatter(content: &str) -> &str {
  if let Some(rest) = content.strip_prefix("---\n") {
    if let Some(end) = rest.find("\n---") {
      let after = &rest[end + 4..];
      return after.strip_prefix('\n').unwrap_or(after);
    }
  }
  content
}

fn find_iso_date(s: &str) -> Option<(usize, usize)> {
  let b = s.as_bytes();
  if b.len() < 10 {
    return None;
  }
  for i in 0..=b.len() - 10 {
    let w = &b[i..i + 10];
    let digits = |c: u8| c.is_ascii_digit();
    if digits(w[0])
      && digits(w[1])
      && digits(w[2])
      && digits(w[3])
      && w[4] == b'-'
      && digits(w[5])
      && digits(w[6])
      && w[7] == b'-'
      && digits(w[8])
      && digits(w[9])
    {
      // reject dates glued to more digits (e.g. phone numbers / ids)
      let before_ok = i == 0 || !b[i - 1].is_ascii_digit();
      let after_idx = i + 10;
      let after_ok = after_idx >= b.len() || !b[after_idx].is_ascii_digit();
      if before_ok && after_ok {
        return Some((i, i + 10));
      }
    }
  }
  None
}

fn valid_month_day(date: &str) -> bool {
  let month: u32 = date[5..7].parse().unwrap_or(0);
  let day: u32 = date[8..10].parse().unwrap_or(0);
  (1..=12).contains(&month) && (1..=31).contains(&day)
}

fn extract_due(text: &str) -> (Option<String>, String) {
  let lower = text.to_lowercase();
  for marker in ["📅", "due:"] {
    if let Some(pos) = lower.find(marker) {
      let seg = &text[pos + marker.len()..];
      let seg_trim_offset = seg.len() - seg.trim_start().len();
      let seg = seg.trim_start();
      if let Some((s, e)) = find_iso_date(seg) {
        let candidate = &seg[s..e];
        if valid_month_day(candidate) {
          let start = pos;
          let end = pos + marker.len() + seg_trim_offset + e;
          let cleaned = format!("{}{}", &text[..start], &text[end..]);
          return (
            Some(candidate.to_string()),
            clean_whitespace(&cleaned),
          );
        }
      }
    }
  }
  if let Some((s, e)) = find_iso_date(text) {
    let candidate = &text[s..e];
    if valid_month_day(candidate) {
      let cleaned = format!("{}{}", &text[..s], &text[e..]);
      return (Some(candidate.to_string()), clean_whitespace(&cleaned));
    }
  }
  (None, text.to_string())
}

fn extract_priority(text: &str) -> (Option<String>, String) {
  let tokens: [(&str, &str); 7] = [
    ("⏫", "high"),
    ("!high", "high"),
    ("🔼", "medium"),
    ("!medium", "medium"),
    ("!med", "medium"),
    ("🔽", "low"),
    ("!low", "low"),
  ];
  let lower = text.to_lowercase();
  for (token, level) in tokens {
    if let Some(pos) = lower.find(token) {
      let end = pos + token.len();
      let cleaned = format!("{}{}", &text[..pos], &text[end..]);
      return (Some(level.to_string()), clean_whitespace(&cleaned));
    }
  }
  (None, text.to_string())
}

fn clean_whitespace(s: &str) -> String {
  s.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}

fn extract_tags(text: &str) -> Vec<String> {
  let mut tags = Vec::new();
  let mut rest = text;
  while let Some(start) = rest.find('#') {
    let boundary_ok = start == 0
      || !(rest.as_bytes()[start - 1] as char).is_alphanumeric();
    let after = &rest[start + 1..];
    let end = after
      .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
      .unwrap_or(after.len());
    if boundary_ok && end > 0 {
      tags.push(after[..end].to_string());
    }
    rest = &after[end.min(after.len())..];
  }
  tags
}

pub fn parse_tasks(content: &str) -> Vec<(usize, bool, String)> {
  let body = body_after_frontmatter(content);
  let mut out = Vec::new();
  let offset = content.len() - body.len();
  for (line_no, line) in (content[..offset].matches('\n').count()..).zip(body.lines()) {
    if let Some((done, text)) = is_checkbox_line(line.trim_start()) {
      out.push((line_no, done, text.to_string()));
    }
  }
  out
}

pub fn collect_tasks(root: &Path) -> Result<Vec<Task>, String> {
  let tree = scan_dir_public(root)?;
  let mut flat = Vec::new();
  flatten_public(&tree, &mut flat);

  let mut tasks = Vec::new();
  for node in flat {
    if node.is_dir {
      continue;
    }
    let ext = Path::new(&node.name)
      .extension()
      .map(|e| e.to_string_lossy().to_lowercase())
      .unwrap_or_default();
    if ext != "md" && ext != "markdown" && ext != "txt" {
      continue;
    }
    let content = match std::fs::read_to_string(&node.path) {
      Ok(c) => c,
      Err(_) => continue,
    };
    let title = note_title(&content, &node.path);
    let folder = Path::new(&node.path)
      .parent()
      .and_then(|p| p.strip_prefix(root).ok())
      .map(|p| p.to_string_lossy().to_string())
      .unwrap_or_default();

    for (line, done, raw_text) in parse_tasks(&content) {
      let (due, t1) = extract_due(&raw_text);
      let (priority, t2) = extract_priority(&t1);
      let tags = extract_tags(&t2);
      tasks.push(Task {
        path: node.path.clone(),
        note_title: title.clone(),
        folder: folder.clone(),
        line,
        text: t2,
        done,
        due,
        priority,
        tags,
      });
    }
  }
  Ok(tasks)
}

fn find_workspace_id(conn: &rusqlite::Connection, path: &Path) -> Option<i64> {
  conn
    .query_row(
      "SELECT id FROM workspaces WHERE path = ?1",
      rusqlite::params![path.to_string_lossy()],
      |r| r.get(0),
    )
    .ok()
}

#[tauri::command]
pub fn task_scan<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
) -> Result<Vec<Task>, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  if find_workspace_id(&conn, Path::new(&workspace_path)).is_none() {
    return Err("Unknown workspace".into());
  }
  collect_tasks(Path::new(&workspace_path))
}

#[tauri::command]
pub fn task_toggle<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  path: String,
  line: usize,
  done: bool,
) -> Result<(), String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &path)?;
  }
  let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
  let mut flipped = false;
  let mut out_lines = Vec::new();
  for (i, l) in content.lines().enumerate() {
    if i == line {
      let trimmed = l.trim_start();
      if let Some((_, text)) = is_checkbox_line(trimmed) {
        let indent_len = l.len() - trimmed.len();
        let indent = &l[..indent_len];
        let marker = trimmed.chars().next().unwrap_or('-');
        let new_state = if done { "x" } else { " " };
        out_lines.push(format!("{}{} [{}] {}", indent, marker, new_state, text));
        flipped = true;
        continue;
      }
      return Err("Target line is not a checkbox".into());
    }
    out_lines.push(l.to_string());
  }
  if !flipped {
    return Err("Line out of range".into());
  }
  let mut new_content = out_lines.join("\n");
  if content.ends_with('\n') {
    new_content.push('\n');
  }
  crate::workspace::note_write(app, path, new_content)
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
  fn task_serializes_camel_case_for_frontend() {
    let t = Task {
      path: "/w/n.md".into(),
      note_title: "N".into(),
      folder: "01-Notes".into(),
      line: 3,
      text: "do it".into(),
      done: false,
      due: Some("2026-01-02".into()),
      priority: None,
      tags: vec!["x".into()],
    };
    let v = serde_json::to_value(&t).unwrap();
    assert!(v.get("noteTitle").is_some());
    assert!(v.get("note_title").is_none());
    assert_eq!(v["due"], "2026-01-02");
  }

  #[test]
  fn parses_checkboxes_done_state_and_skips_frontmatter() {
    let content = "---\ntitle: T\n- [ ] not a task\n---\n\n# T\n- [ ] open\n* [x] done\n  - [X] upper done\nnot [ ] a task\n";
    let tasks = parse_tasks(content);
    assert_eq!(tasks.len(), 3);
    assert_eq!(tasks[0].0, 6);
    assert!(!tasks[0].1);
    assert!(tasks[1].1);
    assert_eq!(tasks[1].0, 7);
    assert!(tasks[2].1);
    assert_eq!(tasks[2].0, 8);
  }

  #[test]
  fn extracts_due_priority_and_strips_tokens() {
    let (due, cleaned) = extract_due("Pay rent 📅 2026-09-01 now");
    assert_eq!(due.as_deref(), Some("2026-09-01"));
    assert_eq!(cleaned, "Pay rent now");

    let (due2, c2) = extract_due("due:2026-01-15 submit");
    assert_eq!(due2.as_deref(), Some("2026-01-15"));
    assert_eq!(c2, "submit");

    let (due3, c3) = extract_due("plain 2026-13-99 invalid");
    assert_eq!(due3, None);
    assert_eq!(c3, "plain 2026-13-99 invalid");

    let (p, cp) = extract_priority("urgent task ⏫");
    assert_eq!(p.as_deref(), Some("high"));
    assert_eq!(cp, "urgent task");

    let (p2, cp2) = extract_priority("chill !low");
    assert_eq!(p2.as_deref(), Some("low"));
    assert_eq!(cp2, "chill");
  }

  #[test]
  fn iso_date_rejects_digit_glued_matches() {
    assert_eq!(find_iso_date("12026-01-01"), None);
    assert_eq!(find_iso_date("2026-01-011"), None);
    assert_eq!(find_iso_date("on 2026-01-01."), Some((3, 13)));
  }

  #[test]
  fn collect_tasks_walks_folders_and_fills_metadata() {
    let dir = std::env::temp_dir().join(format!("nexus_test_tasks_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("02-Projects")).unwrap();
    std::fs::write(
      dir.join("02-Projects/site.md"),
      "# Site\n\n- [ ] launch #web ⏫ 📅 2030-01-02\n- [x] register domain\n",
    )
    .unwrap();

    let tasks = collect_tasks(&dir).unwrap();
    assert_eq!(tasks.len(), 2);
    let t = &tasks[0];
    assert_eq!(t.text, "launch #web");
    assert_eq!(t.priority.as_deref(), Some("high"));
    assert_eq!(t.due.as_deref(), Some("2030-01-02"));
    assert_eq!(t.tags, vec!["web"]);
    assert_eq!(t.folder.replace('\\', "/"), "02-Projects");
    assert_eq!(t.note_title, "Site");
    assert!(!t.done);
    assert!(tasks[1].done);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn toggle_flips_only_target_line() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_toggle_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());
    let path = dir.join("t.md");
    std::fs::write(&path, "# T\n- [ ] a\n- [ ] b\n").unwrap();

    task_toggle(
      app,
      path.to_string_lossy().to_string(),
      2,
      true,
    )
    .unwrap();

    let content = std::fs::read_to_string(&path).unwrap();
    assert_eq!(content, "# T\n- [ ] a\n- [x] b\n");

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn toggle_rejects_non_checkbox_line() {
    let app = mock_app();
    let dir = std::env::temp_dir().join(format!("nexus_test_toggle_bad_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    register_ws(&app, &dir.to_string_lossy());
    let path = dir.join("t.md");
    std::fs::write(&path, "# T\nplain\n").unwrap();

    let err = task_toggle(app, path.to_string_lossy().to_string(), 1, true);
    assert!(err.is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }
}
