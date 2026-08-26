use rusqlite::params;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use tauri::Manager;

use crate::db::Database;
use crate::graph::{build_index, extract_tags, resolve_link, GraphNode};
use crate::linking::{note_title, parse_wiki_links};
use crate::workspace::{flatten_public, scan_dir_public};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanInfo {
  pub path: String,
  pub title: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrokenLinkInfo {
  pub source_path: String,
  pub source_title: String,
  pub target: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
  pub paths: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteHealth {
  pub path: String,
  pub title: String,
  pub score: i64,
  pub words: usize,
  pub links_out: usize,
  pub links_in: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsTotals {
  pub notes: usize,
  pub orphans: usize,
  pub broken_links: usize,
  pub duplicate_groups: usize,
  pub avg_health: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsightsReport {
  pub orphans: Vec<OrphanInfo>,
  pub broken_links: Vec<BrokenLinkInfo>,
  pub duplicates: Vec<DuplicateGroup>,
  pub health: Vec<NoteHealth>,
  pub totals: InsightsTotals,
}

fn body_after_frontmatter(content: &str) -> String {
  crate::util::body_after_frontmatter(content).to_string()
}

pub fn health_score(body: &str, has_frontmatter: bool, links_out: usize) -> i64 {
  let words = body.split_whitespace().count() as i64;
  let mut s: i64 = 40;
  if words >= 50 {
    s += 20;
  }
  if words >= 200 {
    s += 10;
  }
  if links_out > 0 {
    s += 15;
  }
  if body.lines().any(|l| l.starts_with('#')) {
    s += 10;
  }
  if has_frontmatter {
    s += 10;
  }
  if !extract_tags(body).is_empty() {
    s += 5;
  }
  s.clamp(0, 100)
}

fn is_note(name: &str) -> bool {
  crate::util::is_note(name)
}

pub fn build_report(root: &Path) -> Result<InsightsReport, String> {
  let tree = scan_dir_public(root)?;
  let mut flat = Vec::new();
  flatten_public(&tree, &mut flat);

  struct NoteData {
    path: String,
    title: String,
    raw: String,
    body: String,
  }
  let mut notes: Vec<NoteData> = Vec::new();
  for node in flat {
    if node.is_dir || !is_note(&node.name) {
      continue;
    }
    let Ok(raw) = std::fs::read_to_string(&node.path) else {
      continue;
    };
    let title = note_title(&raw, &node.path);
    notes.push(NoteData {
      path: node.path.clone(),
      title,
      body: body_after_frontmatter(&raw),
      raw,
    });
  }

  let graph_nodes: Vec<GraphNode> = notes
    .iter()
    .map(|n| GraphNode {
      path: n.path.clone(),
      title: n.title.clone(),
      tags: Vec::new(),
      links: Vec::new(),
    })
    .collect();
  let index = build_index(&graph_nodes);

  // resolved outgoing edges + broken targets
  let mut out_links: HashMap<String, usize> = HashMap::new();
  let mut in_links: HashMap<String, usize> = HashMap::new();
  let mut broken: Vec<BrokenLinkInfo> = Vec::new();

  for n in &notes {
    let mut seen = std::collections::BTreeSet::new();
    for (target, embed) in parse_wiki_links(&n.raw) {
      if embed {
        continue;
      }
      match resolve_link(&target, &index) {
        Some(dest) => {
          if dest != n.path && seen.insert(dest.clone()) {
            *out_links.entry(n.path.clone()).or_insert(0) += 1;
            *in_links.entry(dest).or_insert(0) += 1;
          }
        }
        None => {
          if seen.insert(target.clone()) {
            broken.push(BrokenLinkInfo {
              source_path: n.path.clone(),
              source_title: n.title.clone(),
              target: target.clone(),
            });
          }
        }
      }
    }
  }

  let mut orphans = Vec::new();
  let mut health = Vec::new();
  for n in &notes {
    let out = *out_links.get(&n.path).unwrap_or(&0);
    let inc = *in_links.get(&n.path).unwrap_or(&0);
    if out == 0 && inc == 0 {
      orphans.push(OrphanInfo {
        path: n.path.clone(),
        title: n.title.clone(),
      });
    }
    health.push(NoteHealth {
      path: n.path.clone(),
      title: n.title.clone(),
      score: health_score(&n.body, n.raw.trim_start().starts_with("---"), out),
      words: n.body.split_whitespace().count(),
      links_out: out,
      links_in: inc,
    });
  }

  // exact-content duplicates
  let mut by_content: HashMap<String, Vec<String>> = HashMap::new();
  for n in &notes {
    by_content
      .entry(n.body.clone())
      .or_default()
      .push(n.path.clone());
  }
  let duplicates: Vec<DuplicateGroup> = by_content
    .into_values()
    .filter(|g| g.len() > 1)
    .map(|paths| DuplicateGroup { paths })
    .collect();

  let avg_health = if health.is_empty() {
    0
  } else {
    health.iter().map(|h| h.score).sum::<i64>() / health.len() as i64
  };

  health.sort_by_key(|a| a.score);

  Ok(InsightsReport {
    totals: InsightsTotals {
      notes: notes.len(),
      orphans: orphans.len(),
      broken_links: broken.len(),
      duplicate_groups: duplicates.len(),
      avg_health,
    },
    orphans,
    broken_links: broken,
    duplicates,
    health,
  })
}

#[tauri::command]
pub fn insights_report(
  app: tauri::AppHandle,
  workspace_path: String,
) -> Result<InsightsReport, String> {
  {
    let db = app.state::<Database>();
    let conn = db.conn();
    let _: i64 = conn
      .query_row(
        "SELECT id FROM workspaces WHERE path = ?1",
        params![workspace_path],
        |r| r.get(0),
      )
      .map_err(|_| "Unknown workspace")?;
  }
  build_report(Path::new(&workspace_path))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn ws(label: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("nexus_insights_{}_{}", label, std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(dir.join("notes")).unwrap();
    dir
  }

  #[test]
  fn health_scores_reward_substance_structure_and_links() {
    assert_eq!(health_score("", false, 0), 40);
    let long = "# Title\n\n".to_string() + "word ".repeat(60).trim();
    assert_eq!(health_score(&long, true, 1), 95); // 40+20+15+10+10
    assert_eq!(health_score("# T\n\nshort", false, 0), 50);
  }

  #[test]
  fn report_finds_orphans_broken_duplicates_and_health() {
    let dir = ws("report");
    std::fs::write(
      dir.join("notes/hub.md"),
      "# Hub\n\nSee [[Target]] and [[Ghost]].\n\nmore words ",
    )
    .unwrap();
    std::fs::write(dir.join("notes/target.md"), "# Target\n\ncontent here\n").unwrap();
    std::fs::write(dir.join("notes/orphan.md"), "# Lonely\n").unwrap();
    std::fs::write(dir.join("notes/dup1.md"), "identical body\n").unwrap();
    std::fs::write(dir.join("notes/dup2.md"), "identical body\n").unwrap();

    let report = build_report(&dir).unwrap();

    assert_eq!(report.totals.notes, 5);

    let orphan_paths: Vec<&str> = report
      .orphans
      .iter()
      .map(|o| o.path.as_str())
      .collect();
    assert!(orphan_paths.iter().any(|p| p.contains("orphan.md")));
    assert!(!orphan_paths.iter().any(|p| p.contains("hub.md")));

    let ghost: Vec<_> = report
      .broken_links
      .iter()
      .filter(|b| b.target == "Ghost")
      .collect();
    assert_eq!(ghost.len(), 1);
    assert!(ghost[0].source_path.ends_with("hub.md"));
    assert!(!report
      .broken_links
      .iter()
      .any(|b| b.target == "Target"));

    assert_eq!(report.duplicates.len(), 1);
    assert_eq!(report.duplicates[0].paths.len(), 2);

    assert_eq!(report.health.len(), 5);
    // hub links out and has a heading → healthier than the one-line orphan stubs
    let hub = report.health.iter().find(|h| h.title.contains("Hub")).unwrap();
    let lonely = report.health.iter().find(|h| h.title.contains("Lonely")).unwrap();
    assert!(hub.score > lonely.score);

    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn empty_workspace_yields_empty_report() {
    let dir = ws("empty");
    let report = build_report(&dir).unwrap();
    assert_eq!(report.totals.notes, 0);
    assert_eq!(report.totals.avg_health, 0);
    assert!(report.orphans.is_empty());
    assert!(report.duplicates.is_empty());
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
