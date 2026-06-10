mod maptracker;
mod screenshots;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

/// Estado compartilhado do app.
struct AppState {
    /// minimap em modo click-through?
    click_through: AtomicBool,
    /// mapa grande está como overlay (na frente do jogo)?
    map_overlay: AtomicBool,
    /// mapa selecionado na janela principal (sincronizado com o minimap)
    selected_map: Mutex<String>,
    /// ids das quests marcadas (sincronizadas com o minimap)
    selected_quests: Mutex<Vec<String>>,
}

fn toggle_minimap_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("minimap") {
        match win.is_visible() {
            Ok(true) => {
                let _ = win.hide();
            }
            _ => {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    }
}

fn apply_click_through(app: &AppHandle, enabled: bool) {
    if let Some(win) = app.get_webview_window("minimap") {
        let _ = win.set_ignore_cursor_events(enabled);
    }
}

fn set_click_through_state(app: &AppHandle, enabled: bool) {
    if let Some(state) = app.try_state::<AppState>() {
        state.click_through.store(enabled, Ordering::Relaxed);
    }
    apply_click_through(app, enabled);
}

#[tauri::command]
fn toggle_minimap(app: AppHandle) {
    toggle_minimap_window(&app);
}

/// Fecha a splash screen e exibe a janela principal.
fn close_splash(app: &AppHandle) {
    if let Some(splash) = app.get_webview_window("splashscreen") {
        let _ = splash.close();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

/// Chamado pelo frontend quando o app terminou de carregar/atualizar.
#[tauri::command]
fn finish_splash(app: AppHandle) {
    close_splash(&app);
}

/// Liga/desliga o click-through do minimap; retorna o novo estado.
#[tauri::command]
fn toggle_click_through(app: AppHandle) -> bool {
    let new = if let Some(state) = app.try_state::<AppState>() {
        !state.click_through.load(Ordering::Relaxed)
    } else {
        false
    };
    set_click_through_state(&app, new);
    new
}

#[tauri::command]
fn set_click_through(app: AppHandle, enabled: bool) {
    set_click_through_state(&app, enabled);
}

/// Tecla M (estilo WoW): traz o mapa grande pra frente do jogo / esconde.
/// Liga: always-on-top + foco. Desliga: minimiza pra voltar à raid.
fn toggle_map_overlay(app: &AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    let on = match app.try_state::<AppState>() {
        Some(s) => {
            let v = !s.map_overlay.load(Ordering::Relaxed);
            s.map_overlay.store(v, Ordering::Relaxed);
            v
        }
        None => true,
    };
    if on {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_always_on_top(true);
        let _ = win.set_focus();
    } else {
        let _ = win.set_always_on_top(false);
        let _ = win.minimize();
    }
}

#[tauri::command]
fn toggle_map(app: AppHandle) {
    toggle_map_overlay(&app);
}

/// Define o mapa selecionado e avisa as outras janelas (minimap).
#[tauri::command]
fn set_selected_map(app: AppHandle, key: String) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut g) = state.selected_map.lock() {
            *g = key.clone();
        }
    }
    let _ = app.emit("map-selected", key);
}

#[tauri::command]
fn get_selected_map(app: AppHandle) -> String {
    app.try_state::<AppState>()
        .and_then(|s| s.selected_map.lock().ok().map(|g| g.clone()))
        .unwrap_or_else(|| "customs".to_string())
}

/// Define as quests marcadas e avisa as outras janelas (minimap).
#[tauri::command]
fn set_selected_quests(app: AppHandle, ids: Vec<String>) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut g) = state.selected_quests.lock() {
            *g = ids.clone();
        }
    }
    let _ = app.emit("quests-selected", ids);
}

#[tauri::command]
fn get_selected_quests(app: AppHandle) -> Vec<String> {
    app.try_state::<AppState>()
        .and_then(|s| s.selected_quests.lock().ok().map(|g| g.clone()))
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    if shortcut.matches(Modifiers::SHIFT, Code::KeyN) {
                        toggle_minimap_window(app);
                    } else if shortcut.matches(Modifiers::empty(), Code::F9) {
                        let new = app
                            .try_state::<AppState>()
                            .map(|s| !s.click_through.load(Ordering::Relaxed))
                            .unwrap_or(false);
                        set_click_through_state(app, new);
                    } else if shortcut.matches(Modifiers::SHIFT, Code::KeyM) {
                        toggle_map_overlay(app);
                    }
                })
                .build(),
        )
        .manage(AppState {
            click_through: AtomicBool::new(false),
            map_overlay: AtomicBool::new(false),
            selected_map: Mutex::new("customs".to_string()),
            selected_quests: Mutex::new(Vec::new()),
        })
        .manage(screenshots::ScreenshotState::default())
        .setup(|app| {
            use tauri_plugin_global_shortcut::GlobalShortcutExt;
            // Shift+N: minimap · F9: click-through · Shift+M: mapa grande na frente do jogo
            let _ = app.global_shortcut().register("Shift+N");
            let _ = app.global_shortcut().register("F9");
            let _ = app.global_shortcut().register("Shift+M");
            // tracking de posição via pasta de screenshots do Tarkov
            screenshots::start_watcher(app.handle().clone());
            // autodetecção do mapa atual via logs do Tarkov
            maptracker::start_watcher(app.handle().clone());
            // fallback: se o frontend não fechar a splash (ex.: erro), fecha em 15s
            let splash_fallback = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(15));
                close_splash(&splash_fallback);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            toggle_minimap,
            finish_splash,
            toggle_click_through,
            set_click_through,
            toggle_map,
            set_selected_map,
            get_selected_map,
            set_selected_quests,
            get_selected_quests,
            screenshots::get_screenshots_dir,
            screenshots::set_screenshots_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
