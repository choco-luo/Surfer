use tauri_plugin_window_state::StateFlags;

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            // 只記憶視窗「位置」，尺寸由前端展開/收合邏輯控制
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![exit_app])
        .on_window_event(|window, event| {
            // 筆記本視窗按下關閉時改為隱藏，讓 Widget 之後還能重新開啟它
            if window.label() == "notebook" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
