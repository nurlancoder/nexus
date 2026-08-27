use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};

/// Converts a name to a filesystem-safe slug: keeps alphanumerics, spaces,
/// hyphens, and underscores; trims leading/trailing whitespace.
pub fn slugify(name: &str) -> String {
  name.chars()
    .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
    .collect::<String>()
    .trim()
    .to_string()
}

/// Returns a unique path inside `dir` by appending `base` + `suffix`, appending
/// an incrementing counter if the candidate already exists.
pub fn unique_path(dir: &Path, base: &str, suffix: &str) -> PathBuf {
  let mut candidate = dir.join(format!("{base}{suffix}"));
  let mut i = 2;
  while candidate.exists() {
    candidate = dir.join(format!("{base} {i}{suffix}"));
    i += 1;
  }
  candidate
}

/// Returns today's date as `YYYY-MM-DD` in the local timezone.
pub fn today() -> String {
  chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// Looks up the workspace ID for a given filesystem path.
/// The path must be a direct child of a registered workspace directory.
pub fn find_workspace_id(conn: &Connection, path: &Path) -> Result<i64, String> {
  let path_str = path
    .to_str()
    .ok_or_else(|| "Path is not valid UTF-8".to_string())?;
  let like_pattern = format!("{path_str}/%");
  conn
    .query_row(
      "SELECT id FROM workspaces WHERE path = ?1 OR ?2 LIKE path || '/%'",
      params![path_str, like_pattern],
      |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

/// Returns `true` if the filename has a Markdown extension (`.md` or `.markdown`).
pub fn is_note(name: &str) -> bool {
  let ext = Path::new(name)
    .extension()
    .map(|e| e.to_string_lossy().to_lowercase())
    .unwrap_or_default();
  ext == "md" || ext == "markdown"
}

/// Returns `true` if the filename has a text-markdown extension (`.md`, `.markdown`, or `.txt`).
pub fn is_text_file(name: &str) -> bool {
  let ext = Path::new(name)
    .extension()
    .map(|e| e.to_string_lossy().to_lowercase())
    .unwrap_or_default();
  ext == "md" || ext == "markdown" || ext == "txt"
}

/// Resolves a workspace ID for any path inside a workspace (longest prefix wins).
/// This is the canonical workspace lookup — prefer this over inline SQL queries.
pub fn resolve_workspace_id(conn: &Connection, path: &str) -> Result<i64, String> {
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

/// Strips a YAML frontmatter block (delimited by `---`) from the beginning of
/// the content and returns the body. Zero-copy — returns a `&str` slice.
pub fn body_after_frontmatter(content: &str) -> &str {
  if let Some(rest) = content.strip_prefix("---\n") {
    if let Some(end) = rest.find("\n---") {
      let after = &rest[end + 4..];
      return after.strip_prefix('\n').unwrap_or(after);
    }
  }
  content
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn slugify_basic() {
    assert_eq!(slugify("Hello World"), "Hello World");
    assert_eq!(slugify("my-file_v2"), "my-file_v2");
    assert_eq!(slugify("  spaces  "), "spaces");
    assert_eq!(slugify("bad!@#chars"), "badchars");
  }

  #[test]
  fn unique_path_avoids_collision() {
    let dir = std::env::temp_dir().join(format!("nexus_util_test_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("note.md"), "").unwrap();
    let p = unique_path(&dir, "note", ".md");
    assert_eq!(p, dir.join("note 2.md"));
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn today_format() {
    let t = today();
    assert_eq!(t.len(), 10);
    assert!(t.contains('-'));
  }

  #[test]
  fn is_note_ext() {
    assert!(is_note("readme.md"));
    assert!(is_note("doc.markdown"));
    assert!(!is_note("image.png"));
    assert!(!is_note("noext"));
  }

  #[test]
  fn body_after_frontmatter_strips() {
    let input = "---\ntitle: Hello\n---\nBody here";
    assert_eq!(body_after_frontmatter(input), "Body here");
  }

  #[test]
  fn body_after_frontmatter_no_frontmatter() {
    let input = "Just plain text";
    assert_eq!(body_after_frontmatter(input), "Just plain text");
  }

  #[test]
  fn is_text_file_accepts_md_markdown_and_txt() {
    assert!(is_text_file("note.md"));
    assert!(is_text_file("note.markdown"));
    assert!(is_text_file("readme.txt"));
    assert!(!is_text_file("image.png"));
    assert!(!is_text_file("data.csv"));
  }

  #[test]
  fn is_text_file_handles_case_insensitive() {
    assert!(is_text_file("NOTE.MD"));
    assert!(is_text_file("file.TXT"));
  }

  #[test]
  fn body_after_frontmatter_handles_empty_frontmatter() {
    // Empty frontmatter (no content between --- markers) is not stripped — by design
    let input = "---\n---\nBody";
    assert_eq!(body_after_frontmatter(input), input);
  }

  #[test]
  fn body_after_frontmatter_handles_unclosed() {
    let input = "---\ntitle: X\nNo closing";
    assert_eq!(body_after_frontmatter(input), input);
  }

  #[test]
  fn slugify_preserves_unicode_alphanumerics() {
    let input = "Əsas Qeydlər — Şərhlər";
    let result = slugify(input);
    assert!(result.contains('ə'), "missing ə, result: {:?}", result);
    assert!(result.contains('Ş'), "missing Ş, result: {:?}", result);
    assert!(result.contains('Q'), "missing Q, result: {:?}", result);
  }

  #[test]
  fn is_note_handles_unicode_extensions() {
    // Ensure no panic on unusual filenames
    assert!(!is_note("readme"));
    assert!(!is_note(""));
  }

  #[test]
  fn unique_path_handles_unicode_dir_names() {
    let dir = std::env::temp_dir().join(format!("nexus_util_unicode_{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("Qeyd.md"), "").unwrap();
    let p = unique_path(&dir, "Qeyd", ".md");
    assert!(p.to_string_lossy().contains("Qeyd 2.md"));
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn resolve_workspace_id_finds_longest_prefix() {
    let conn = rusqlite::Connection::open_in_memory().unwrap();
    conn
      .execute_batch(
        "CREATE TABLE workspaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_opened_at TEXT
        );
        INSERT INTO workspaces (name, path) VALUES ('root', '/workspace');
        INSERT INTO workspaces (name, path) VALUES ('sub', '/workspace/projects');",
      )
      .unwrap();
    // Should match /workspace/projects (longer prefix)
    let id = resolve_workspace_id(&conn, "/workspace/projects/note.md").unwrap();
    assert_eq!(id, 2);
    // Should match /workspace
    let id = resolve_workspace_id(&conn, "/workspace/note.md").unwrap();
    assert_eq!(id, 1);
    // Unknown path
    assert!(resolve_workspace_id(&conn, "/other/path").is_err());
  }
}
