// Autodetecção do mapa atual pela leitura dos logs do EFT.
//
// O jogo grava, ao entrar numa raid, uma linha no application log com o nome
// interno do mapa, ex.:
//   ...|application|TRACE-NetworkGameCreate profileStatus: '... Location: bigmap, ...'
// Observamos a pasta `<install>\Logs` e, a cada nova linha dessas, traduzimos o
// nome interno para a `key` do mapsConfig e emitimos o evento `map-detected`.

use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use notify::{EventKind, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Traduz o nome interno da location do EFT para a `key` usada no mapsConfig.
/// Retorna `None` para mapas/modos que não exibimos (ex.: hideout, menus).
fn map_key(internal: &str) -> Option<&'static str> {
    Some(match internal.trim().to_ascii_lowercase().as_str() {
        "bigmap" => "customs",
        "factory4_day" | "factory4_night" => "factory",
        "sandbox" | "sandbox_high" => "ground-zero",
        "interchange" => "interchange",
        "lighthouse" => "lighthouse",
        "rezervbase" => "reserve",
        "shoreline" => "shoreline",
        "tarkovstreets" => "streets-of-tarkov",
        "woods" => "woods",
        "laboratory" => "the-lab",
        "labyrinth" => "the-labyrinth",
        "terminal" => "terminal",
        _ => return None,
    })
}

/// Extrai o nome interno da location de uma linha de log, se for a linha de
/// criação da partida. `... Location: bigmap, Sid: ...` -> `Some("bigmap")`.
fn parse_location(line: &str) -> Option<&str> {
    if !line.contains("TRACE-NetworkGameCreate") {
        return None;
    }
    let idx = line.find("Location:")?;
    let rest = line[idx + "Location:".len()..].trim_start();
    let end = rest.find(',').unwrap_or(rest.len());
    Some(rest[..end].trim())
}

/// Diretório de instalação do EFT, via registro do Windows; com fallback para o
/// caminho padrão. Em SOs não-Windows usa só o fallback (que não deve existir).
fn eft_install_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let subkeys = [
            r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\EscapeFromTarkov",
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\EscapeFromTarkov",
        ];
        for sub in subkeys {
            if let Ok(key) = hklm.open_subkey(sub) {
                if let Ok(loc) = key.get_value::<String, _>("InstallLocation") {
                    let p = PathBuf::from(loc);
                    if p.exists() {
                        return Some(p);
                    }
                }
            }
        }
    }
    let def = PathBuf::from(r"C:\Battlestate Games\Escape from Tarkov");
    def.exists().then_some(def)
}

fn logs_dir() -> Option<PathBuf> {
    let d = eft_install_dir()?.join("Logs");
    d.exists().then_some(d)
}

fn is_app_log(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.contains("application") && n.ends_with(".log"))
        .unwrap_or(false)
}

/// O application log mais recente entre todas as pastas `log_*` — usado para
/// semear o mapa atual quando o app inicia com o jogo já aberto.
fn newest_app_log(logs: &Path) -> Option<PathBuf> {
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for folder in std::fs::read_dir(logs).ok()?.flatten() {
        let Ok(entries) = std::fs::read_dir(folder.path()) else {
            continue;
        };
        for f in entries.flatten() {
            if !is_app_log(&f.path()) {
                continue;
            }
            if let Ok(mt) = f.metadata().and_then(|m| m.modified()) {
                if best.as_ref().map(|(b, _)| mt > *b).unwrap_or(true) {
                    best = Some((mt, f.path()));
                }
            }
        }
    }
    best.map(|(_, p)| p)
}

/// Lê os bytes novos de um application log (a partir de `offset`) e devolve a
/// ÚLTIMA location reconhecida no trecho — i.e. o mapa mais recente. Atualiza
/// `offset` para o fim do arquivo (lidando com rotação/truncamento).
fn last_location_since(path: &Path, offset: &mut u64) -> Option<&'static str> {
    let mut file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    if len < *offset {
        *offset = 0; // arquivo rotacionou/encolheu
    }
    file.seek(SeekFrom::Start(*offset)).ok()?;
    let mut buf = String::new();
    file.read_to_string(&mut buf).ok()?;
    *offset = len;

    let mut found = None;
    for line in buf.lines() {
        if let Some(loc) = parse_location(line) {
            if let Some(key) = map_key(loc) {
                found = Some(key);
            }
        }
    }
    found
}

/// Inicia o watcher dos logs numa thread dedicada. Falhas são silenciosas
/// (jogo não instalado etc.) — o app segue funcionando, só sem autodetecção.
pub fn start_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let Some(logs) = logs_dir() else {
            return;
        };

        // offset por arquivo já lido; e o último mapa emitido (para deduplicar).
        let mut offsets: HashMap<PathBuf, u64> = HashMap::new();
        let mut last_emitted: Option<&'static str> = None;

        let mut emit_for = |path: &Path, offsets: &mut HashMap<PathBuf, u64>| {
            let off = offsets.entry(path.to_path_buf()).or_insert(0);
            if let Some(key) = last_location_since(path, off) {
                if last_emitted != Some(key) {
                    last_emitted = Some(key);
                    let _ = app.emit("map-detected", key);
                }
            }
        };

        // semeia o mapa atual a partir do log mais recente (jogo já aberto).
        if let Some(newest) = newest_app_log(&logs) {
            emit_for(&newest, &mut offsets);
        }

        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        }) {
            Ok(w) => w,
            Err(_) => return,
        };
        // recursivo: novas raids/sessões criam novas pastas `log_*`.
        if watcher.watch(&logs, RecursiveMode::Recursive).is_err() {
            return;
        }

        for res in rx {
            let Ok(event) = res else { continue };
            if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                continue;
            }
            for path in event.paths {
                if is_app_log(&path) {
                    emit_for(&path, &mut offsets);
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::{map_key, parse_location};

    #[test]
    fn parses_real_create_line() {
        let line = "2026-06-07 00:03:38.360|1.0.5.0.45464|Debug|application|TRACE-NetworkGameCreate profileStatus: 'Profileid: abc, Status: Busy, RaidMode: Online, Ip: 1.2.3.4, Port: 17008, Location: bigmap, Sid: X, GameMode: deathmatch, shortId: YYX0KG'";
        assert_eq!(parse_location(line), Some("bigmap"));
        assert_eq!(map_key("bigmap"), Some("customs"));
    }

    #[test]
    fn ignores_unrelated_lines() {
        assert_eq!(parse_location("...|application|LocationLoaded:29.25 real:36.14"), None);
    }

    #[test]
    fn maps_known_internal_names() {
        assert_eq!(map_key("Sandbox_high"), Some("ground-zero"));
        assert_eq!(map_key("Shoreline"), Some("shoreline"));
        assert_eq!(map_key("RezervBase"), Some("reserve"));
        assert_eq!(map_key("factory4_night"), Some("factory"));
        assert_eq!(map_key("hideout"), None);
    }
}
