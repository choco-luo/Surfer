use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use tauri_plugin_window_state::StateFlags;

/// SQLite schema — roadmapwidgetplan.md 第 4 節資料模型
fn db_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init schema",
        sql: r#"
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                note TEXT,
                scheduled_date TEXT NOT NULL,
                scheduled_date_end TEXT,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'scheduled',
                completed_at TEXT,
                duration_ms INTEGER
            );
            CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                color TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS item_tags (
                item_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (item_id, tag_id)
            );
            CREATE TABLE IF NOT EXISTS daily_summaries (
                date TEXT PRIMARY KEY,
                generated_at TEXT NOT NULL,
                unfinished_item_ids TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        "#,
        kind: MigrationKind::Up,
    }]
}

/// 切換浮窗（Widget）顯示/隱藏
fn toggle_widget(app: &AppHandle) {
    if let Some(widget) = app.get_webview_window("widget") {
        if widget.is_visible().unwrap_or(false) {
            let _ = widget.hide();
        } else {
            let _ = widget.show();
            let _ = widget.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:surfer.db", db_migrations())
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(
            // 只記憶視窗「位置」，尺寸由前端展開/收合邏輯控制
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .setup(|app| {
            // 系統托盤（Windows 右下角通知區域 / macOS 右上角選單列）
            // 左鍵點擊圖示 → 切換浮窗顯示；右鍵 → 選單（結束程式從這裡）
            let toggle =
                MenuItem::with_id(app, "toggle", "顯示/隱藏小工具", true, None::<&str>)?;
            let notebook =
                MenuItem::with_id(app, "notebook", "開啟筆記本", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "結束 surfer", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&toggle, &notebook, &PredefinedMenuItem::separator(app)?, &quit],
            )?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("surfer")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => toggle_widget(app),
                    "notebook" => {
                        if let Some(win) = app.get_webview_window("notebook") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_widget(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
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
