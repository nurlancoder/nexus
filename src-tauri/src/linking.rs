use rusqlite::params;
use serde::Serialize;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkHit {
  pub path: String,
  pub title: String,
  pub snippet: String,
  pub matched: String,
  pub via_link: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkResolution {
  pub backlinks: Vec<LinkHit>,
  pub mentions: Vec<LinkHit>,
}

pub fn frontmatter_value(content: &str, key: &str) -> Vec<String> {
  let mut out = Vec::new();
  let mut in_fm = false;
  let mut block = false;
  for line in content.lines() {
    if line.trim() == "---" {
      if in_fm {
        break;
      }
      in_fm = true;
      continue;
    }
    if !in_fm {
      continue;
    }
    let trimmed = line.trim();
    if trimmed.starts_with(&format!("{key}:")) {
      let rest = trimmed[format!("{key}:").len()..].trim();
      if rest.is_empty() {
        block = true;
      } else if rest.starts_with('[') && rest.ends_with(']') {
        for part in rest[1..rest.len() - 1].split(',') {
          let p = part.trim().trim_matches('"').trim_matches('\'');
          if !p.is_empty() {
            out.push(p.to_string());
          }
        }
      } else {
        out.push(rest.trim_matches('"').trim_matches('\'').to_string());
      }
      continue;
    }
    if block && trimmed.starts_with("- ") {
      out.push(trimmed[2..].trim().to_string());
    }
  }
  out
}

pub fn note_title(content: &str, path: &str) -> String {
  let fm = frontmatter_value(content, "title");
  if let Some(t) = fm.first() {
    if !t.is_empty() {
      return t.clone();
    }
  }
  for line in content.lines() {
    if let Some(rest) = line.trim().strip_prefix("# ") {
      let t = rest.trim();
      if !t.is_empty() {
        return t.to_string();
      }
    }
  }
  Path::new(path)
    .file_stem()
    .map(|s| s.to_string_lossy().to_string())
    .unwrap_or_else(|| path.to_string())
}

pub fn parse_wiki_links(body: &str) -> Vec<(String, bool)> {
  let mut out = Vec::new();
  let bytes = body.as_bytes();
  let mut i = 0;
  while i + 1 < bytes.len() {
    if bytes[i] == b'[' && bytes[i + 1] == b'[' {
      let embed = i >= 1 && bytes[i - 1] == b'!';
      let start = i + 2;
      let end = body[start..]
        .find("]]")
        .map(|e| start + e)
        .unwrap_or(body.len());
      let inner = &body[start..end];
      let target = inner.split(['|', '#']).next().unwrap_or("").trim();
      if !target.is_empty() {
        out.push((target.to_string(), embed));
      }
      i = end + 2;
    } else {
      i += 1;
    }
  }
  out
}

fn matches_target(candidate: &str, targets: &[String]) -> bool {
  let cand = candidate.trim().to_lowercase();
  let base = cand.rsplit('/').next().unwrap_or(&cand);
  for t in targets {
    let t = t.trim().to_lowercase();
    if t.is_empty() {
      continue;
    }
    if base == t || base == t.trim_end_matches(".md") || cand == t {
      return true;
    }
  }
  false
}

fn floor_char_boundary(s: &str, index: usize) -> usize {
  if index >= s.len() {
    return s.len();
  }
  let mut i = index;
  while i > 0 && !s.is_char_boundary(i) {
    i -= 1;
  }
  i
}

fn ceil_char_boundary(s: &str, index: usize) -> usize {
  if index >= s.len() {
    return s.len();
  }
  let mut i = index;
  while i < s.len() && !s.is_char_boundary(i) {
    i += 1;
  }
  i
}

fn make_snippet(content: &str, idx: usize, len: usize) -> String {
  let start = floor_char_boundary(content, idx.saturating_sub(40));
  let end = ceil_char_boundary(content, (idx + len + 40).min(content.len()));
  let mut s = content[start..end].replace(['\n', '\r'], " ");
  s = s.split_whitespace().collect::<Vec<_>>().join(" ");
  let prefix = if start > 0 { "…" } else { "" };
  let suffix = if end < content.len() { "…" } else { "" };
  format!("{prefix}{s}{suffix}")
}

pub fn resolve_links<R: tauri::Runtime>(app: &tauri::AppHandle<R>, workspace_path: &str, target_path: &str) -> Result<LinkResolution, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let ws_id: i64 = conn
    .query_row(
      "SELECT id FROM workspaces WHERE path = ?1",
      params![workspace_path],
      |r| r.get(0),
    )
    .map_err(|e| e.to_string())?;

  let target_content = std::fs::read_to_string(target_path).map_err(|e| e.to_string())?;
  let target_title = note_title(&target_content, target_path);
  let mut targets = vec![target_title.clone()];
  targets.extend(frontmatter_value(&target_content, "aliases"));

  let mut backlinks = Vec::new();
  let mut mentions = Vec::new();

  let mut stmt = conn
    .prepare("SELECT path, title FROM files WHERE workspace_id = ?1 AND type = 'note'")
    .map_err(|e| e.to_string())?;
  let rows = stmt
    .query_map(params![ws_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
    .map_err(|e| e.to_string())?;

  for row in rows {
    let (path, title) = row.map_err(|e| e.to_string())?;
    if path == target_path {
      continue;
    }
    let content = match std::fs::read_to_string(&path) {
      Ok(c) => c,
      Err(_) => continue,
    };
    let lower = content.to_lowercase();

    let mut is_backlink = false;
    for (target, _embed) in parse_wiki_links(&content) {
      if matches_target(&target, &targets) {
        is_backlink = true;
        break;
      }
    }

    if is_backlink {
      let idx = content
        .find("[[")
        .unwrap_or(0);
      backlinks.push(LinkHit {
        path: path.clone(),
        title: title.clone(),
        snippet: make_snippet(&content, idx, 8),
        matched: target_title.clone(),
        via_link: true,
      });
      continue;
    }

    for t in &targets {
      let needle = t.to_lowercase();
      if needle.len() < 2 {
        continue;
      }
      if let Some(idx) = lower.find(&needle) {
        if !is_backlink {
          mentions.push(LinkHit {
            path,
            title,
            snippet: make_snippet(&content, idx, needle.len()),
            matched: t.clone(),
            via_link: false,
          });
        }
        break;
      }
    }
  }

  backlinks.sort_by_key(|a| a.title.to_lowercase());
  mentions.sort_by_key(|a| a.title.to_lowercase());

  Ok(LinkResolution { backlinks, mentions })
}

#[tauri::command]
pub fn linking_resolve<R: tauri::Runtime>(
  app: tauri::AppHandle<R>,
  workspace_path: String,
  target_path: String,
) -> Result<LinkResolution, String> {
  {
    let db = app.state::<Database>();
    crate::security::validate_path(&db.conn(), &target_path)?;
  }
  resolve_links(&app, &workspace_path, &target_path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_wiki_links_and_embeds() {
    let links = parse_wiki_links("See [[React]] and [[Page|alias#Section]] plus ![[img.png]].");
    assert_eq!(links, vec![
      ("React".to_string(), false),
      ("Page".to_string(), false),
      ("img.png".to_string(), true),
    ]);
  }

  #[test]
  fn frontmatter_value_handles_inline_block_and_quoted() {
    let content = "---\ntitle: \"Quoted\"\naliases: [Foo, \"Bar\"]\n---\n";
    assert_eq!(frontmatter_value(content, "title"), vec!["Quoted"]);
    assert_eq!(frontmatter_value(content, "aliases"), vec!["Foo", "Bar"]);
  }

  #[test]
  fn note_title_prefers_frontmatter_then_h1() {
    assert_eq!(note_title("---\ntitle: T\n---\n# H1", "x.md"), "T");
    assert_eq!(note_title("# H1 Only", "x.md"), "H1 Only");
    assert_eq!(note_title("body", "/tmp/hello.md"), "hello");
  }

  #[test]
  fn matches_target_by_base_or_full_path() {
    let targets = vec!["React".to_string(), "My Alias".to_string()];
    assert!(matches_target("React", &targets));
    assert!(matches_target("notes/React", &targets));
    assert!(matches_target("My Alias", &targets));
    assert!(!matches_target("Rust", &targets));
  }

  #[test]
  fn snippet_is_whitespace_collapsed_with_ellipsis() {
    let content = "word ".repeat(200);
    let s = make_snippet(&content, 0, 4);
    assert!(s.starts_with("word"));
    assert!(s.ends_with('…'));
  }
}