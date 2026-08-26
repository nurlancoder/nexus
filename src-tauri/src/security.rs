use rusqlite::Connection;
use std::path::{Component, Path, PathBuf};

/// Normalizes a path by resolving `.` and `..` components without requiring the path to exist.
/// Handles both Unix `/` and Windows `\` separators.
pub fn normalize_path(path: &str) -> String {
    let mut components = Vec::new();
    for component in Path::new(path).components() {
        match component {
            Component::ParentDir => {
                components.pop();
            }
            Component::CurDir => {}
            c => components.push(c),
        }
    }
    let normalized: PathBuf = components.iter().collect();
    normalized.to_string_lossy().to_string()
}

/// Validates that a file path lies within at least one registered workspace.
/// Rejects null bytes before normalization; normalizes the path to prevent `..` traversal bypasses.
/// Checks for symlink escapes by verifying each existing path component with `symlink_metadata`.
pub fn validate_path(conn: &Connection, path: &str) -> Result<(), String> {
    if path.contains('\0') {
        return Err("Path contains null byte".into());
    }
    let normalized = normalize_path(path);
    let workspace_id = crate::search::find_workspace_id_for_path(conn, &normalized)?;

    let ws_root: String = conn
        .query_row(
            "SELECT path FROM workspaces WHERE id = ?1",
            rusqlite::params![workspace_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let norm_path = PathBuf::from(&normalized);
    let root = Path::new(&ws_root);

    for ancestor in norm_path.ancestors() {
        if ancestor == root || ancestor == Path::new("/") || ancestor == Path::new("") {
            break;
        }
        match std::fs::symlink_metadata(ancestor) {
            Ok(meta) => {
                if meta.file_type().is_symlink() {
                    let target = std::fs::read_link(ancestor).map_err(|e| e.to_string())?;
                    let resolved = if target.is_absolute() {
                        target
                    } else {
                        ancestor.parent()
                            .unwrap_or(Path::new("/"))
                            .join(&target)
                    };
                    let canon_root = std::fs::canonicalize(root).map_err(|e| e.to_string())?;
                    let canon_target = std::fs::canonicalize(&resolved).map_err(|e| e.to_string())?;
                    if !canon_target.starts_with(&canon_root) {
                        return Err("Path escapes workspace via symlink".into());
                    }
                }
            }
            Err(_) => continue,
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_resolves_dotdot() {
        assert_eq!(
            normalize_path("/home/user/notes/../secret.md"),
            "/home/user/secret.md"
        );
    }

    #[test]
    fn normalize_handles_dots() {
        assert_eq!(
            normalize_path("/home/user/notes/./note.md"),
            "/home/user/notes/note.md"
        );
    }

    #[test]
    fn normalize_preserves_valid_path() {
        assert_eq!(
            normalize_path("/home/user/notes/note.md"),
            "/home/user/notes/note.md"
        );
    }

    #[test]
    fn validate_rejects_path_outside_workspace() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );
            INSERT INTO workspaces (name, path) VALUES ('ws', '/home/user/notes');",
        )
        .unwrap();

        // Path inside workspace — ok
        assert!(validate_path(&conn, "/home/user/notes/docs/note.md").is_ok());
        assert!(validate_path(&conn, "/home/user/notes/note.md").is_ok());

        // Path outside workspace — rejected
        assert!(validate_path(&conn, "/home/user/notes-tricky/evil.md").is_err());
        assert!(validate_path(&conn, "/etc/passwd").is_err());
    }

    #[test]
    fn validate_rejects_dotdot_traversal() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );
            INSERT INTO workspaces (name, path) VALUES ('ws', '/home/user/notes');",
        )
        .unwrap();

        // Traversal with .. — rejected after normalization
        assert!(validate_path(&conn, "/home/user/notes/../../../etc/passwd").is_err());
        assert!(validate_path(&conn, "/home/user/notes/sub/../../other.md").is_err());
    }

    #[test]
    fn validate_path_rejects_null_bytes() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );
            INSERT INTO workspaces (name, path) VALUES ('ws', '/home/user/notes');",
        )
        .unwrap();

        assert!(validate_path(&conn, "/home/user/notes/file\0.md").is_err());
        assert!(validate_path(&conn, "\0/etc/passwd").is_err());
        assert!(validate_path(&conn, "/home/user/notes/ok.md").is_ok());
    }

    #[test]
    fn validate_rejects_deeply_nested_dotdot_traversal() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );
            INSERT INTO workspaces (name, path) VALUES ('ws', '/home/user/notes');",
        )
        .unwrap();

        // 2-level up from notes/sub goes to /home, which is outside ws
        assert!(validate_path(&conn, "/home/user/notes/sub/../../secret.md").is_err());
        // 3-level up from notes/sub/deep goes to /home/user, which is outside ws
        assert!(validate_path(&conn, "/home/user/notes/sub/deep/../../../../etc/passwd").is_err());
        // 6-level up from deep nesting also escapes
        assert!(validate_path(&conn, "/home/user/notes/a/b/c/d/e/../../../../../../etc/passwd").is_err());
    }

    #[test]
    fn validate_rejects_workspace_prefix_sibling() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );
            INSERT INTO workspaces (name, path) VALUES ('ws', '/home/user/notes');",
        )
        .unwrap();

        assert!(validate_path(&conn, "/home/user/notes-evil/secret.md").is_err());
        assert!(validate_path(&conn, "/home/user/notes_tricky/file.md").is_err());
        assert!(validate_path(&conn, "/home/user/notes.md/file.md").is_err());
    }

    #[test]
    fn validate_rejects_null_bytes_at_various_positions() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE workspaces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                path TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened_at TEXT
            );
            INSERT INTO workspaces (name, path) VALUES ('ws', '/home/user/notes');",
        )
        .unwrap();

        assert!(validate_path(&conn, "/home/user/notes/file\0.md").is_err());
        assert!(validate_path(&conn, "/home/user/notes/\0.md").is_err());
        assert!(validate_path(&conn, "\0/home/user/notes/file.md").is_err());
        assert!(validate_path(&conn, "/home/user/no\0tes/file.md").is_err());
        assert!(validate_path(&conn, "/home/user/notes/file.md\0").is_err());
    }

    #[test]
    fn validate_path_rejects_symlink_escape() {
        let tmp = std::env::temp_dir().join(format!(
            "nexus_test_symlink_{}",
            std::process::id()
        ));
        let ws = tmp.join("workspace");
        let outside = tmp.join("outside");
        std::fs::create_dir_all(ws.join("sub")).unwrap();
        std::fs::create_dir_all(&outside).unwrap();

        // Register workspace in DB
        let conn = Connection::open_in_memory().unwrap();
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
        conn.execute(
            "INSERT INTO workspaces (name, path) VALUES ('ws', ?1)",
            rusqlite::params![ws.to_str().unwrap()],
        )
        .unwrap();

        // Create symlink inside workspace pointing outside
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, ws.join("sub/escape")).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(&outside, ws.join("sub/escape")).unwrap();

        // Path through symlink that would resolve outside workspace — rejected
        let bad_path = ws.join("sub/escape/secret.txt");
        assert!(
            validate_path(&conn, bad_path.to_str().unwrap()).is_err(),
            "symlink escape should be rejected"
        );

        // Normal path inside workspace — ok
        let good_path = ws.join("sub/note.md");
        assert!(validate_path(&conn, good_path.to_str().unwrap()).is_ok());

        // Non-existent file inside workspace — ok (for creation flows)
        let new_path = ws.join("sub/new.md");
        assert!(validate_path(&conn, new_path.to_str().unwrap()).is_ok());

        std::fs::remove_dir_all(&tmp).unwrap();
    }
}
