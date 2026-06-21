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
use std::sync::mpsc::RecvTimeoutError;
use std::time::Duration;

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
/// ÚLTIMA location reconhecida no trecho — i.e. o mapa mais recente.
///
/// Avança `offset` apenas até a ÚLTIMA quebra de linha lida: assim, uma linha
/// ainda em escrita (parcial) não é consumida pela metade e é relida inteira no
/// próximo evento. Lida com rotação/truncamento e com bytes não-UTF-8.
fn last_location_since(path: &Path, offset: &mut u64) -> Option<&'static str> {
    let mut file = std::fs::File::open(path).ok()?;
    let len = file.metadata().ok()?.len();
    if len < *offset {
        *offset = 0; // arquivo rotacionou/encolheu
    }
    file.seek(SeekFrom::Start(*offset)).ok()?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf).ok()?;

    // só consome até a última linha COMPLETA; a sobra (linha sendo escrita pelo
    // jogo agora) fica para o próximo read, evitando casar com linha cortada.
    let consumed = match buf.iter().rposition(|&b| b == b'\n') {
        Some(i) => i + 1,
        None => return None, // nenhuma linha completa ainda; não avança o offset
    };
    *offset += consumed as u64;

    let text = String::from_utf8_lossy(&buf[..consumed]);
    let mut found = None;
    for line in text.lines() {
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

        // offset por arquivo já lido. Não deduplicamos por último mapa aqui: cada
        // linha `NetworkGameCreate` nova é uma raid nova e deve re-emitir (o front
        // ignora quando o mapa não muda). Assim, re-entrar no mesmo mapa depois de
        // uma troca manual volta a sincronizar.
        let mut offsets: HashMap<PathBuf, u64> = HashMap::new();

        let emit_for = |path: &Path, offsets: &mut HashMap<PathBuf, u64>| {
            let off = offsets.entry(path.to_path_buf()).or_insert(0);
            if let Some(key) = last_location_since(path, off) {
                let _ = app.emit("map-detected", key);
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

        loop {
            match rx.recv_timeout(Duration::from_secs(2)) {
                Ok(Ok(event)) => {
                    if matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
                        for path in event.paths {
                            if is_app_log(&path) {
                                emit_for(&path, &mut offsets);
                            }
                        }
                    }
                }
                Ok(Err(_)) => {}
                // a cada 2s sem evento, re-escaneia o log mais recente: rede de
                // segurança caso o notify perca/atrase eventos (comum no Windows).
                Err(RecvTimeoutError::Timeout) => {
                    if let Some(newest) = newest_app_log(&logs) {
                        emit_for(&newest, &mut offsets);
                    }
                }
                Err(RecvTimeoutError::Disconnected) => break,
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

    // Garante que uma linha ainda em escrita (sem \n) não é consumida pela metade:
    // o offset não avança e a linha é relida inteira quando completar.
    #[test]
    fn partial_line_is_not_consumed_until_complete() {
        use std::io::Write;
        let mut path = std::env::temp_dir();
        path.push("tqc_maptracker_partial_test.log");
        let _ = std::fs::remove_file(&path);

        // metade da linha, sem newline
        std::fs::write(&path, "00:00|app|TRACE-NetworkGameCreate ... Location: bigm").unwrap();
        let mut off = 0u64;
        assert_eq!(super::last_location_since(&path, &mut off), None);
        assert_eq!(off, 0, "linha parcial não pode avançar o offset");

        // completa a linha (agora com \n)
        let mut f = std::fs::OpenOptions::new().append(true).open(&path).unwrap();
        write!(f, "ap, Sid: X'\n").unwrap();
        assert_eq!(super::last_location_since(&path, &mut off), Some("customs"));

        let _ = std::fs::remove_file(&path);
    }
}
