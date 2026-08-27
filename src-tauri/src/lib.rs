mod attachments;
mod calendar;
mod canvas;
mod database;
mod db;
mod graph;
mod history;
mod insights;
mod linking;
mod plugins;
mod projects;
mod search;
mod security;
mod tasks;
mod templates;
#[cfg(test)]
mod test_helpers;
mod util;
mod workspace;

use db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Database::init(app.handle())?;
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      app_info,
      workspace::workspace_create,
      workspace::workspace_open,
      workspace::workspace_recent,
      workspace::workspace_tree,
      workspace::note_read,
      workspace::note_write,
      workspace::note_create,
      workspace::note_rename,
      workspace::note_delete,
      workspace::note_move,
      workspace::note_duplicate,
      search::search_query,
      search::search_reindex,
      linking::linking_resolve,
      graph::linking_graph,
      canvas::canvas_create,
      canvas::canvas_save,
      canvas::canvas_load,
      database::database_list,
      database::database_save,
      database::database_delete,
      database::database_rows,
      tasks::task_scan,
      tasks::task_toggle,
      projects::project_list,
      projects::project_detail_cmd,
      calendar::calendar_events,
      calendar::daily_note_open,
      attachments::attachment_save,
      attachments::attachment_list,
      attachments::attachment_read,
      attachments::attachment_delete,
      templates::template_list,
      templates::template_read,
      templates::template_create_note,
      history::history_list,
      history::history_get,
      history::history_restore,
      history::history_prune,
      insights::insights_report,
      plugins::plugin_list,
      plugins::plugin_read
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
fn app_info(app: tauri::AppHandle) -> Result<String, String> {
  let db = app.state::<Database>();
  let conn = db.conn();
  let count: i64 = conn
    .query_row("SELECT COUNT(*) FROM workspaces", [], |r| r.get(0))
    .map_err(|e| e.to_string())?;
  Ok(format!("NEXUS v{} — sqlite ok ({} workspaces)", env!("CARGO_PKG_VERSION"), count))
}