#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn close_chat_window(app: tauri::AppHandle) -> Result<(), String> {
    let chat_window = app
        .get_webview_window("chat")
        .ok_or_else(|| "chat window not found".to_string())?;
    chat_window.destroy().map_err(|error| error.to_string())
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // 先隐藏全部窗口（main + chat），视觉上立即消失
    for (_label, window) in app.webview_windows() {
        let _ = window.hide();
    }
    // 后台优雅退出：request_exit 为非阻塞消息投递，
    // 事件循环按 FIFO 先处理 Hide 再处理 ExitRequested，清理全程窗口不可见
    app.exit(0);
}

#[tokio::main]
async fn main() {
    tauri::async_runtime::set(tokio::runtime::Handle::current());
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![close_chat_window, exit_app])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
