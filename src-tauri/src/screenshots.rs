// Tracking de posição do jogador pela pasta de screenshots do Tarkov.
//
// O EFT grava prints com as coordenadas no NOME do arquivo, ex.:
//   2020-05-08[19-39]_-275.0, 5.5, -284.6_0.0, 0.1, 0.0, 1.0_0.00 (0).png
// A primeira tripla (x, y, z) é a posição do jogador. Observamos a pasta e,
// a cada print novo, emitimos o evento `player-position` para o frontend.
//
// A pasta pode ser a padrão (Documentos\Escape from Tarkov\Screenshots) ou uma
// escolhida pelo usuário nas configurações; ela é persistida em settings.json e
// o watcher é reiniciado quando muda (ver `apply` / `set_screenshots_dir`).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, serde::Serialize)]
struct PositionPayload {
    x: f64,
    y: f64,
    z: f64,
    /// quaternion de rotação [qx, qy, qz, qw], se presente no nome do print
    q: Option<[f64; 4]>,
    #[serde(rename = "observedAt")]
    observed_at: u64,
}

/// Estado do watcher de screenshots, mantido vivo no app. Trocar o `watcher`
/// (drop do antigo) para de observar a pasta anterior.
#[derive(Default)]
pub struct ScreenshotState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    current: Mutex<Option<PathBuf>>,
}

/// Info devolvida ao frontend sobre a pasta de screenshots.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotDirInfo {
    /// pasta efetivamente observada (custom ou padrão)
    dir: String,
    /// true se o usuário definiu uma pasta custom
    is_custom: bool,
    /// pasta padrão (para exibir/explicar o "Usar padrão")
    default_dir: String,
}

/// Extrai posição (x, y, z) e o quaternion de rotação do nome do print.
/// Formato EFT: `..._X, Y, Z_qx, qy, qz, qw_...` — a posição é o 1º segmento
/// com 3 floats; o quaternion é o 1º segmento seguinte com 4 floats.
pub fn parse_pose(name: &str) -> Option<((f64, f64, f64), Option<[f64; 4]>)> {
    let mut pos: Option<(f64, f64, f64)> = None;
    let mut quat: Option<[f64; 4]> = None;
    for seg in name.split('_') {
        let commas = seg.matches(',').count();
        let nums: Vec<f64> = seg
            .split(',')
            .filter_map(|s| s.trim().parse::<f64>().ok())
            .collect();
        if pos.is_none() && commas == 2 && nums.len() == 3 {
            pos = Some((nums[0], nums[1], nums[2]));
        } else if pos.is_some() && quat.is_none() && commas == 3 && nums.len() == 4 {
            quat = Some([nums[0], nums[1], nums[2], nums[3]]);
        }
    }
    pos.map(|p| (p, quat))
}

/// Pasta padrão de screenshots do EFT.
fn default_dir(app: &AppHandle) -> Option<PathBuf> {
    let docs = app.path().document_dir().ok()?;
    Some(docs.join("Escape from Tarkov").join("Screenshots"))
}

/// Arquivo de configuração do app (settings.json no app config dir).
fn config_file(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_config_dir().ok()?.join("settings.json"))
}

/// Lê o dir custom salvo (se houver e não-vazio).
fn read_custom_dir(app: &AppHandle) -> Option<PathBuf> {
    let path = config_file(app)?;
    let txt = std::fs::read_to_string(path).ok()?;
    let v: serde_json::Value = serde_json::from_str(&txt).ok()?;
    let s = v.get("screenshotsDir")?.as_str()?;
    if s.trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(s))
    }
}

/// Persiste (ou limpa, com `None`) o dir custom, preservando outras chaves.
fn write_custom_dir(app: &AppHandle, dir: Option<&str>) -> Result<(), String> {
    let path = config_file(app).ok_or("sem diretório de configuração")?;
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut v: serde_json::Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    if !v.is_object() {
        v = serde_json::json!({});
    }
    match dir {
        Some(d) => v["screenshotsDir"] = serde_json::Value::String(d.to_string()),
        None => {
            if let Some(o) = v.as_object_mut() {
                o.remove("screenshotsDir");
            }
        }
    }
    let out = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    std::fs::write(&path, out).map_err(|e| e.to_string())
}

/// Dir efetivo: custom se setado, senão o padrão.
fn effective_dir(app: &AppHandle) -> Option<PathBuf> {
    read_custom_dir(app).or_else(|| default_dir(app))
}

/// Constrói um watcher para `dir`, emitindo `player-position` a cada print novo.
fn build_watcher(app: &AppHandle, dir: &Path) -> Option<RecommendedWatcher> {
    // cria a pasta se não existir, para o watcher já ficar pronto
    let _ = std::fs::create_dir_all(dir);

    let handle = app.clone();
    let mut watcher =
        notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                return;
            }
            for path in event.paths {
                let is_png = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("png"))
                    .unwrap_or(false);
                if !is_png {
                    continue;
                }
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if let Some(((x, y, z), q)) = parse_pose(stem) {
                        let _ = handle.emit("player-position", PositionPayload { x, y, z, q, observed_at: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() as u64 });
                    }
                }
            }
        })
        .ok()?;
    watcher.watch(dir, RecursiveMode::NonRecursive).ok()?;
    Some(watcher)
}

/// (Re)inicia o watcher no dir efetivo, guardando-o no estado. Falhas são
/// silenciosas (ex.: jogo não instalado) — o app continua, só sem tracking.
pub fn apply(app: &AppHandle) {
    let Some(state) = app.try_state::<ScreenshotState>() else {
        return;
    };
    let dir = effective_dir(app);
    let new_watcher = dir.as_ref().and_then(|d| build_watcher(app, d));
    {
        let mut w = state.watcher.lock().unwrap_or_else(|e| e.into_inner());
        *w = new_watcher;
    }
    {
        let mut c = state.current.lock().unwrap_or_else(|e| e.into_inner());
        *c = dir;
    }
}

/// Inicia o watcher no boot (chamado no setup, com o estado já gerenciado).
pub fn start_watcher(app: AppHandle) {
    apply(&app);
}

#[tauri::command]
pub fn get_screenshots_dir(app: AppHandle) -> ScreenshotDirInfo {
    let custom = read_custom_dir(&app);
    let default_dir = default_dir(&app)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let dir = custom
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| default_dir.clone());
    ScreenshotDirInfo {
        dir,
        is_custom: custom.is_some(),
        default_dir,
    }
}

/// Define a pasta custom (`None`/vazio = volta ao padrão) e reinicia o watcher.
#[tauri::command]
pub fn set_screenshots_dir(app: AppHandle, dir: Option<String>) -> Result<ScreenshotDirInfo, String> {
    let trimmed = dir.as_deref().map(str::trim).filter(|s| !s.is_empty());
    write_custom_dir(&app, trimmed)?;
    apply(&app);
    Ok(get_screenshots_dir(app))
}

#[cfg(test)]
mod tests {
    use super::parse_pose;

    #[test]
    fn parses_eft_filename() {
        let name = "2020-05-08[19-39]_-275.0, 5.5, -284.6_0.0, 0.1, 0.0, 1.0_0.00 (0)";
        assert_eq!(
            parse_pose(name),
            Some(((-275.0, 5.5, -284.6), Some([0.0, 0.1, 0.0, 1.0])))
        );
    }
}
