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
}
