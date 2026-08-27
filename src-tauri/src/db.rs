use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

pub struct Database(pub Mutex<Connection>);

impl Database {
  pub fn init(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_data_dir)?;
    let db_path = app_data_dir.join("nexus.sqlite");

    let conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    migrate(&conn)?;

    app.manage(Database(Mutex::new(conn)));
    Ok(())
  }

  pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
    match self.0.lock() {
      Ok(guard) => guard,
      Err(poisoned) => poisoned.into_inner(),
    }
  }
}

fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
  conn.execute_batch(include_str!("../migrations/001_init.sql"))?;
  Ok(())
}