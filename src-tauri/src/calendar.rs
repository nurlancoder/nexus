use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::linking::{frontmatter_value, note_title};
use crate::tasks::collect_tasks;
use crate::workspace::{flatten_public, scan_dir_public};

#[derive(Serialize)]
pub struct CalendarEvent {
  pub date: String,
  pub kind: String,
  pub path: String,
  pub title: String,
}

#[derive(Serialize)]
pub struct DailyNoteInfo {
  pub path: String,
  pub created: bool,
}

fn is_daily_note(name: &str) -> Option<String> {
  let stem = Path::new(name).file_stem()?.to_string_lossy().to_string();
  let ext = Path::new(name)
    .extension()
    .map(|e| e.to_string_lossy().to_lowercase())
    .unwrap_or_default();
  if ext != "md" && ext != "markdown" {
    return None;
  }
  if stem.len() == 10
    && stem.as_bytes()[4] == b'-'
    && stem.as_bytes()[7] == b'-'
    && stem.chars().enumerate().all(|(i, c)| {
      if i == 4 || i == 7 {
        c == '-'
      } else {
        c.is_ascii_digit()
      }
    })
  {
    Some(stem)
  } else {
    None
  }
}

fn valid_date(date: &str) -> bool {
  if date.len() != 10 || date.as_bytes()[4] != b'-' || date.as_bytes()[7] != b'-' {
    return false;
  }
  let month: u32 = date[5..7].parse().unwrap_or(0);
  let day: u32 = date[8..10].parse().unwrap_or(0);
  (1..=12).contains(&month) && (1..=31).contains(&day)
}

pub fn collect_events(workspace_path: &str, year: i32, month: u32) -> Result<Vec<CalendarEvent>, String> {
  let prefix = format!("{:04}-{:02}", year, month);
  let root = Path::new(workspace_path);
  if !root.is_dir() {
    return Err("Unknown workspace".into());
  }

  let tree = scan_dir_public(root)?;
  let mut flat = Vec::new();
  flatten_public(&tree, &mut flat);

  let mut events: Vec<CalendarEvent> = Vec::new();

  for node in flat {
    if node.is_dir {
      continue;
    }
    let ext = Path::new(&node.name)
      .extension()
      .map(|e| e.to_string_lossy().to_lowercase())
      .unwrap_or_default();
    if ext != "md" && ext != "markdown" {
      continue;
    }
    let content = match std::fs::read_to_string(&node.path) {
      Ok(c) => c,
      Err(_) => continue,
    };
    let title = note_title(&content, &node.path);

    if let Some(date) = is_daily_note(&node.name) {
      if date.starts_with(&prefix) {
        events.push(CalendarEvent {
          date,
          kind: "daily".into(),
          path: node.path.clone(),
          title,
        });
      }
      continue;
    }

    for value in frontmatter_value(&content, "date") {
      let v = value.trim().trim_matches('"').trim_matches('\'').to_string();
      if v.starts_with(&prefix) && valid_date(&v) {
        events.push(CalendarEvent {
          date: v,
          kind: "note".into(),
          path: node.path.clone(),
          title,
        });
        break;
      }
    }
  }

  let tasks = collect_tasks(root).unwrap_or_default();
  for t in tasks {
    if let Some(due) = &t.due {
      if due.starts_with(&prefix) {
        events.push(CalendarEvent {
          date: due.clone(),
          kind: "task".into(),
          path: t.path.clone(),
          title: t.text,
        });
      }
    }
  }

  events.sort_by(|a, b| {
    a.date
      .cmp(&b.date)
      .then_with(|| a.kind.cmp(&b.kind))
      .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
  });
  Ok(events)
}

fn today() -> String {
  chrono::Local::now().format("%Y-%m-%d").to_string()
}

pub fn open_daily_note(workspace_path: &str, date: &str) -> Result<DailyNoteInfo, String> {
  if !valid_date(date.trim()) {
    return Err(format!("Invalid date: {}", date));
  }
  let date = date.trim();
  let dir = Path::new(workspace_path).join("01-Notes").join("Daily");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let path = dir.join(format!("{}.md", date));
  if path.exists() {
    return Ok(DailyNoteInfo {
      path: path.to_string_lossy().to_string(),
      created: false,
    });
  }
  let content = format!(
    "---\ntitle: {}\ntype: daily\ncreated: {}\nupdated: {}\ntags:\n\n---\n\n# {}\n\n",
    date,
    today(),
    today(),
    date
  );
  let tmp = path.with_extension("tmp");
  std::fs::write(&tmp, content).map_err(|e| e.to_string())?;
  std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
  Ok(DailyNoteInfo {
    path: path.to_string_lossy().to_string(),
    created: true,
  })
}

#[tauri::command]
pub fn calendar_events<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  year: i32,
  month: u32,
) -> Result<Vec<CalendarEvent>, String> {
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
  if !(1..=12).contains(&month) {
    return Err("Invalid month".into());
  }
  collect_events(&workspace_path, year, month)
}

#[tauri::command]
pub fn daily_note_open<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  date: String,
) -> Result<DailyNoteInfo, String> {
  {
    let db = app.state::<crate::db::Database>();
    let conn = db.conn();
    crate::security::validate_path(&conn, &workspace_path)?;
  }
  let info = open_daily_note(&workspace_path, &date)?;
  if info.created {
    crate::workspace::note_write(app, info.path.clone(), std::fs::read_to_string(&info.path).map_err(|e| e.to_string())?)?;
  }
  Ok(info)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn detects_iso_named_daily_notes_only() {
    assert_eq!(is_daily_note("2026-08-21.md"), Some("2026-08-21".into()));
    assert_eq!(is_daily_note("2026-08-21.markdown"), Some("2026-08-21".into()));
    assert_eq!(is_daily_note("note.md"), None);
    assert_eq!(is_daily_note("2026-8-1.md"), None);
    assert_eq!(is_daily_note("2026/08/21.md"), None);
    assert_eq!(is_daily_note("2026-08-21.txt"), None);
    assert_eq!(is_daily_note("12026-08-21.md"), None);
  }

  #[test]
  fn validates_dates() {
    assert!(valid_date("2026-08-21"));
    assert!(!valid_date("2026-13-01"));
    assert!(!valid_date("2026-00-10"));
    assert!(!valid_date("20260821"));
    assert!(!valid_date("2026-08-2"));
  }

  #[test]
  fn collects_dailies_dated_notes_and_task_due_dates() {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_cal_{}", std::process::id()));
    std::fs::create_dir_all(dir.join("01-Notes/Daily")).unwrap();
    std::fs::create_dir_all(dir.join("02-Projects")).unwrap();
    std::fs::write(dir.join("01-Notes/Daily/2026-03-05.md"), "# 2026-03-05\n").unwrap();
    std::fs::write(
      dir.join("02-Projects/launch.md"),
      "---\ntitle: Launch\ndate: 2026-03-10\n---\n\n# Launch\n",
    )
    .unwrap();
    std::fs::write(
      dir.join("02-Projects/plan.md"),
      "# Plan\n\n- [ ] ship 📅 2026-03-12\n- [ ] other 📅 2026-04-01\n",
    )
    .unwrap();

    let events = collect_events(dir.to_str().unwrap(), 2026, 3).unwrap();
    let kinds: Vec<&str> = events.iter().map(|e| e.kind.as_str()).collect();
    assert_eq!(kinds, vec!["daily", "note", "task"]);
    assert_eq!(events[0].date, "2026-03-05");
    assert_eq!(events[1].title, "Launch");
    assert_eq!(events[2].title, "ship");

    let april = collect_events(dir.to_str().unwrap(), 2026, 4).unwrap();
    assert_eq!(april.len(), 1);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn open_daily_creates_once_then_reuses() {
    let dir =
      std::env::temp_dir().join(format!("nexus_test_daily_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();

    let first = open_daily_note(dir.to_str().unwrap(), "2031-01-02").unwrap();
    assert!(first.created);
    let content = std::fs::read_to_string(&first.path).unwrap();
    assert!(content.contains("title: 2031-01-02"));
    assert!(content.contains("type: daily"));
    assert!(content.contains("# 2031-01-02"));

    let second = open_daily_note(dir.to_str().unwrap(), "2031-01-02").unwrap();
    assert!(!second.created);
    assert_eq!(first.path, second.path);

    assert!(open_daily_note(dir.to_str().unwrap(), "bad-date").is_err());

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn open_daily_note_rejects_unknown_workspace() {
    let app = {
      use rusqlite::Connection;
      use std::sync::Mutex;
      let app = tauri::test::mock_app();
      let conn = Connection::open_in_memory().unwrap();
      conn
        .execute_batch(
          "CREATE TABLE workspaces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_opened_at TEXT
          );",
        )
        .unwrap();
      conn
        .execute(
          "INSERT INTO workspaces (name, path) VALUES ('Known', '/tmp/nexus_known_ws')",
          [],
        )
        .unwrap();
      app.manage(crate::db::Database(Mutex::new(conn)));
      app.handle().clone()
    };
    assert!(daily_note_open(app, "UNKNOWN".into(), "2031-01-01".into()).is_err());
  }
}
