# Changelog

## 1.2.0 — 2026-11-25

- Refresh all task, map, extraction, spawn, loot, storyline, guide and image data.
- Add separate persistent PvP, PvE and seasonal PvP catalogs and local progress profiles, with English and Portuguese task data.
- Add Icebreaker with 16 floors and updated multi-floor Lab artwork; refresh the upstream map catalog and aliases.
- Add task/objective search, trader/level/Kappa filters, completion checklists and a library that includes tasks without coordinates.
- Add a raid supplies/key checklist and a floor-aware suggested sequence of objective visits.
- Clarify paid/item/flare/switch/cooperation extraction requirements and distinguish shared-faction exits from cooperative exits.
- Show content freshness, guide coverage and age of the last confirmed screenshot position.
- Replace the unavailable GraphQL sync with the maintained JSON API, conditional HTTP caching, retries, staged refresh and offline validation.
- Add frontend/data regression tests, Windows CI and weekly/manual validated-content artifacts. Update compatible npm dependencies and the image processor.

Known limits: guides remain English; suggested visits are not navigable paths; position updates still require in-game screenshots. Installed apps do not download new content automatically.
