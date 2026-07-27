## Why

GPX export is the last unbuilt core piece of the MVP and the product's closing move: Wayborne plans the trip, the rider's own nav app rides it. The Ask's success criterion is explicit — the file must import cleanly into Detecht (the benchmark) and a Garmin. Days are assembled, region 01 geometry is seeded, and riding season is open; nothing downstream blocks on anything else.

Detecht's import contract (scraped 2026-07-26, `research/detecht-gpx-import-notes.md` in the project workspace) shapes the whole design: a GPX `<rte>` auto-converts to an editable, navigable route with no extra prompt, while a `<trk>` forces a track-options detour; their importer supports up to 240 waypoints but recommends staying under 30, and decimates above that. Detecht re-routes between route points with its own engine, so the file must hand it intent — sparse, named, well-placed points — not raw shape.

## What Changes

- New pure GPX builder in `src/lib/gpx.ts` (sibling of `route.ts`, node-testable, no new dependencies): emits a GPX 1.1 `<rte>` file for one day leg.
- Route points derive from the day's items in ride order: each stop contributes one named `rtept`; each curated segment contributes named entry, shaping, and exit `rtept`s, oriented by nearest-endpoint chaining so roads are ridden the right way around.
- A per-file point budget keeps exports inside Detecht's recommended limit; shaping points collapse first when a day runs long.
- Items without usable geometry (untraced segments, ungeocoded stops) are excluded from the file and surfaced to the rider as visible notes — never silently dropped.
- Days view (`days-view.tsx`) gets a per-day Export GPX action; generation and download are fully client-side (Blob, no server round-trip).
- Explicitly out of scope (v2 or never): Valhalla-routed connector geometry in the file, whole-trip single file, `<wpt>` stop layer, `<trk>` track mode, turn-by-turn anything, server-side generation, Detecht API integration.

## Capabilities

### New Capabilities
- `gpx-export`: per-day GPX 1.1 route export — point derivation from day legs, segment orientation, point budget, missing-geometry honesty, file naming, and the days-view export action.

### Modified Capabilities

<!-- none: trip-assembly, trip-tray, and curation-data-access requirements are unchanged; export reads what they already provide -->

## Impact

- New: `src/lib/gpx.ts`, `src/lib/gpx.test.ts`.
- Touched: `src/components/trip/days-view.tsx` (export action + missing-geometry notes).
- Reads existing data only: region rows already carry client-side GeoJSON (computed `geojson` columns), tray refs resolve through the existing catalog. No schema, RPC, or API changes; no new packages; no new env vars.
- Acceptance beyond unit tests is manual: a real import into Detecht (route auto-opens, named points, curated roads held on the line) and a Garmin import. The shaping-point count is a tunable constant pending that field test.
