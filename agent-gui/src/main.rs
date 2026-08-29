#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn close_chat_window(app: tauri::AppHandle) -> Result<(), String> {
    let chat_window = app
        .get_webview_window("chat")
        .ok_or_else(|| "chat window not found".to_string())?;
    chat_window.destroy().map_err(|error| error.to_string())
}

#[tokio::main]
async fn main() {
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![close_chat_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
