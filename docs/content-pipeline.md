# Content pipeline and coverage

Version 1.2.0 refresh: 25 November 2026.

| Source | Responsibility | Why it is used |
| --- | --- | --- |
| [tarkov.dev JSON API](https://json.tarkov.dev/endpoints) | Structured tasks, objectives, coordinates, maps, containers, traders and EN/PT/RU translations | This is the API used by the current tarkov.dev frontend. The previous GraphQL endpoint returns an unavailable response. |
| [Upstream map catalog](https://github.com/the-hideout/tarkov-dev/blob/main/src/data/maps.json) | Projection, bounds, map authors, tile layers and aliases | Keeps artwork and coordinates in the same reference system. |
| [tarkov.help](https://tarkov.help/en) | Written guides, images, storyline and curated extraction notes | Complements structured data with visual explanations. |

No source has been established as universally more current or accurate. JSON responses include origin Last-Modified/ETag where available; `public/data/meta.json` records these alongside SHA-256 hashes and the actual download date. The UI distinguishes the bundle refresh date from the origin task-data date.

## Refresh behavior

`npm run sync:all` copies the existing offline bundle into an ignored staging directory, refreshes all data and assets there, validates references and coordinates, and then swaps the validated bundle into place. HTTP failures abort instead of silently publishing partial datasets. A publication failure restores the previous public directory. Individual output files use temporary-file replacement. The HTTP cache only reuses bytes after origin revalidation; it does not silently label stale cached JSON as fresh.

Language expansion follows the source's declared translation paths. IDs and references remain unchanged. Tasks use their stable source IDs for progress. Marker deduplication collapses identical points across aliases while keeping distinct objectives separate.

All game modes are bundled: regular 503 tasks, PvE 499, season 462. Of these, 235/235/223 tasks respectively have geographic objective points. Tasks without points remain searchable. Missing coordinates are never invented. There are 13 base map layouts; night/high-level/event variants use the upstream aliases and their common base artwork. Static extraction/spawn layers display the base map dataset, so confirm the raid's active extraction list in-game.

Current map assets include Icebreaker's 16 floors and the updated tile-based Lab. Icebreaker ships through native zoom 3, Lab through zoom 4 and Labyrinth through zoom 6; further zoom enlarges those local tiles. This bounds offline bundle size. Map imagery retains author/link attribution in the generated catalog.

The guide matcher joins English slugs to Russian task names within each trader. It reports coverage rather than guessing unmatched guides. Image-to-objective assignments require an unambiguous text match; otherwise images remain available in the whole-task carousel. A single geographic objective receives its guide's images. Image names include a hash of their source URL to prevent filename collisions. Original image bytes are revalidated; changed images are reconverted and unreferenced files are removed from staging before validation. Curated extraction notes in `scripts/data/extract-notes.json` record verification date and sources and require review after gameplay patches. Payment, transfer items and switches come from the JSON API; shared faction eligibility is distinct from PMC/Scav cooperation.

## Planning and progress

Objective checkmarks, storyline checkmarks and selected tasks are stored locally per game mode. The original regular-mode selected-task key is preserved. Required keys are deduplicated; single-item marking/planting/use objectives contribute quantities. Lists of interchangeable supplies are left in the objective description rather than incorrectly requiring every option. Check equipment and alternative-item requirements in the guide before a raid.

The visit planner groups objectives by floor and proximity. It selects one potential spawn for quest items that have alternatives. It does not model walls, locked doors, elevation paths, enemies, extract availability or quest dependency unlocks. A numbered sequence is shown as focusable stops, without drawing misleading straight-line paths through walls. Completing a required objective removes its points from both map windows.

## Position updates

Position and orientation come from the filename of an in-game screenshot; map detection reads game logs. The confirmed-position timestamp is shown in both windows. This release does not read game memory, intercept traffic, estimate motion or provide continuous telemetry. [TarkovMonitor](https://github.com/the-hideout/TarkovMonitor) also documents screenshot-based map positioning. Continuous visual localization would need a separate measured prototype, map reference material and explicit confidence reporting.

## Automation and verification

The Check workflow validates offline data, runs frontend tests/build and Rust tests on Windows. The weekly/manual Refresh content workflow stages and validates an update and uploads an artifact for 14 days. It has read-only repository permissions and does not publish or automatically install new content. Existing tag-based releases remain drafts until published by the owner.

Local verification covers translations and stable IDs, references, finite coordinates, image existence, PNG/SVG assets, SVG floor groups, projection round trips, loot type coverage, mode-separated progress, task search/completion and visit ordering. In-game behavior and the appearance of the native windows still require a manual play session.
