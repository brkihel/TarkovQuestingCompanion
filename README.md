<div align="center">

# 🗺️ Tarkov Questing Companion

**An offline desktop companion for Escape from Tarkov with screenshot-based player positioning, quest planning and progress tracking.**

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

Tarkov Questing Companion is a native desktop app that runs alongside the game and turns map-reading into something effortless. It **detects which map you load into**, **updates your position when you take an in-game screenshot**, and overlays **quest markers, objectives, loot, exits and your own pins** on top of high-resolution maps — so you always know where to go next.

No memory reading, no injection, no overlays on top of the game. It works purely by watching the screenshots and log files the game already writes to disk.

## 📸 Screenshots

<div align="center">

![Customs with quest objectives, extracts and floor selector](docs/screenshots/customs.png)

<table>
  <tr>
    <td><img src="docs/screenshots/the-lab.png" alt="The Lab — multi-floor view" /></td>
    <td><img src="docs/screenshots/streets.png" alt="Streets of Tarkov" /></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/interchange.png" alt="Interchange" /></td>
    <td align="center"><em>🎮 Live in-raid<br/>player tracking<br/>(coming soon)</em></td>
  </tr>
</table>

</div>

## ✨ Features

- 🧭 **Confirmed player position** — an in-game screenshot updates position and facing in the main map and minimap. Both windows show how old that position is. Continuous tracking without screenshots is not implemented.
- 🎮 **Three game modes** — separate persistent PvP, PvE and seasonal PvP catalogs, selections and objective progress.
- ✅ **Quest planning** — search by task or objective, filter trader/level/Kappa, hide completed tasks, and browse tasks without coordinates.
- 🎒 **Raid checklist** — keys and single required marking/planting supplies for selected quests on the current map. Suggested visit order groups nearby objectives by floor; it is not a walkable route or a safety guarantee. Alternative item spawns contribute one suggested stop.
- 🎯 **Quest objectives on the map** — every task from [tarkov.dev](https://tarkov.dev) plotted by location, with an "Objective i/N" badge and reference images per point.
- 🗂️ **Auto map detection** — the app reads the game logs and switches to the correct map when you load into a raid.
- 🪜 **Floor switching** — multi-level maps (Labs, Interchange, Streets…) filter loot, spawns, exits and transits by floor automatically as you move.
- 💎 **Loot & exits** — extracts, transits, spawns and loot points rendered with clean per-type SVG glyphs.
- 📌 **Custom markers** — drop your own colored pins anywhere to mark stashes, fights or routes.
- 🧩 **Quest guides & images** — synced objective descriptions and screenshots to help you find tricky spots.
- 🌍 **Bilingual** — English and Portuguese (BR).

## 🔧 How it works

Escape from Tarkov writes your coordinates into the **filename of every in-raid screenshot**, and logs the map name when a raid loads. The companion simply watches those files:

| Source | What it gives | Used for |
| --- | --- | --- |
| Screenshot folder | `x, y, z` position + facing | Live player arrow & floor tracking |
| Game log files | Loaded location | Automatic map switching |
| [tarkov.dev](https://tarkov.dev) API | Quests, objectives, markers | Map data (synced offline) |

Just bind a screenshot key in-game and press it whenever you want your position refreshed.

## 🗺️ Supported maps

Customs · Factory · Ground Zero · Icebreaker · Interchange · Lighthouse · Reserve · Shoreline · Streets of Tarkov · Woods · Terminal · The Lab · The Labyrinth

---

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 24.15+
- [Rust](https://www.rust-lang.org/tools/install) (stable) + the [Tauri prerequisites](https://tauri.app/start/prerequisites/) (on Windows: WebView2, usually already installed)

### Run in development

```bash
npm install
npm run tauri dev
```

### Build a release binary

```bash
npm run tauri build
```

The installer/executable is produced under `src-tauri/target/release/`.

### Refresh all content

```bash
npm run sync:all       # stage → download → normalize → validate → publish
npm run check          # offline data validation, component/unit tests, production frontend build
```

On Windows, stop the development server before publishing the staged directory. If a directory lock prevents publication, stop the app/server and run `npm run sync:all -- --publish-staged` to revalidate and publish the already downloaded content.

The complete refresh covers all three game modes in English and Portuguese, maps, extraction conditions, loot, storyline, guides and reference images. Network requests use timeouts, retries and conditional caching. A failed download or validation leaves the published bundle intact; `.sync-cache/previous-public` retains the previous successful bundle. Intermediate sync commands remain available, but use `sync:all` for a consistent full refresh.

The **Refresh content** GitHub workflow runs weekly and can also be started manually. It produces a validated content artifact retained for 14 days. It does not commit changes, create a release or update installed apps automatically. Refreshing this repository and distributing a new app build are still separate actions.

The app loads bundled files offline, with no third-party requests during a raid. Portuguese task data falls back to English when unavailable. Written guides remain in English. See [content sources and limitations](docs/content-pipeline.md).

### First use

1. Launch the app and open **Settings** to confirm your Tarkov **screenshots folder** (defaults to `Documents\Escape from Tarkov\Screenshots`).
2. Choose your **game mode** in the sidebar. Selections and objective checkmarks are saved independently for each mode.
3. Make sure you have a **screenshot key** bound in the game.
4. Drop into a raid — the map switches automatically. Press your screenshot key to update your position.

---

## 🙏 Credits

- Quest data and markers from the wonderful [tarkov.dev](https://tarkov.dev) project and its contributors.
- Built with [Tauri](https://tauri.app/), [React](https://react.dev/) and [Leaflet](https://leafletjs.com/).

## ⚠️ Disclaimer

This is an **unofficial, fan-made** tool and is **not affiliated with, endorsed by, or associated with Battlestate Games**. *Escape from Tarkov* and all related assets are property of Battlestate Games. The app does not interact with the game process in any way — it only reads files the game writes to disk.

## 📄 License

Released under the [MIT License](LICENSE).
