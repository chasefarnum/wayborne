## Context

Days are contiguous slices of the tray's ride order (`distributeDayCounts` in `src/lib/trip.ts`); connectors between curated items are deliberately unrouted. Segments carry full traced LineStrings and stops carry pins, both already reaching the client as GeoJSON via the computed `geojson` columns. The nav benchmark's import contract is documented in the project workspace at `research/detecht-gpx-import-notes.md`: a GPX `<rte>` imports frictionlessly and Detecht re-routes between route points with its own engine; waypoint counts should stay under ~30 per file; exported waypoints are rider-visible and skippable in navigation.

Two prior calls bind this design: the GPX parser is a tolerant tag scan, not DOMParser (design amendment, along-route-discovery), and export must not reintroduce an XML dependency; and Google-derived content or coordinates never persist, so everything exportable is store-friendly by construction.

## Goals / Non-Goals

**Goals:**
- A rider exports one riding day as a GPX 1.1 file that imports into Detecht as an immediately editable, navigable route with named, meaningful points, and into a Garmin.
- Detecht's router is held onto curated roads by construction: oriented entry/exit points plus tunable shaping points per segment.
- Honesty holds at the file boundary: anything the file can't carry (untraced segment, ungeocoded stop) is excluded and said out loud in the UI.

**Non-Goals:**
- No routed connector geometry inside the file (Detecht's engine owns the line between our points; Valhalla-routed export is the v2 escalation if shaping points prove insufficient in the field).
- No whole-trip single file, no `<wpt>` layer, no `<trk>` track mode in v1.
- No server involvement, no new dependencies, no schema or RPC changes.

## Decisions

**1. Export a `<rte>`, not a `<trk>`.** Detecht auto-converts a route file and drops the rider straight into edit/save/navigate; a track file forces the Track Options detour and its Convert to Route path re-routes anyway, so exact track shape buys nothing for the benchmark. Garmin units likewise recalculate routes on import. Alternative considered: dual rte+trk in one file — parked; two line carriers in one file is exactly the ambiguity that makes importers guess.

**2. Points are intent, not shape.** Each stop emits one `rtept` named after the stop. Each segment emits an entry point, `SHAPING_POINTS_PER_SEGMENT` interior points (evenly spaced by arc length along the traced line), and an exit point — named after the road ("NY-28A · start", "NY-28A", "NY-28A · end"). Shaping starts at 1 per segment; it is a constant tuned by the field test, not a schema property. Rationale: Detecht re-routes between points, and every exported point is rider-visible and skippable, so filler points are UX damage — the minimum set that pins the router to the curated road wins.

**3. Segment orientation by nearest-endpoint chaining.** Walk the day's items in ride order keeping a moving anchor (the last emitted coordinate). A segment enters at whichever endpoint is closer to the anchor. The first item, when it is a segment, orients against the next item's location instead; a day with no other located item keeps traced direction. Haversine already exists in `route.ts`. Alternative considered: persisting an orientation flag per tray item — rejected, it's derivable and the tray stays a list of refs.

**4. Point budget enforces Detecht's guidance, softly.** Shaping points are included only while the file total stays ≤ 30; they collapse (longest segments keep theirs last) before any stop or entry/exit point is touched. Entry/exit and stop points are never dropped: if those alone exceed 30, the file still exports — Detecht supports 240 — and the count is the rider's signal that the day is overstuffed. Alternative considered: hard cap with our own decimation — rejected; silently rewriting the rider's plan is the exact failure the provenance brand exists to avoid.

**5. Builder is a pure function; download is a Blob.** `src/lib/gpx.ts` exports `buildDayGpx(...)` returning `{ xml, excluded, pointCount }` — no React, no fetch, string assembly with manual XML escaping (mirror of the parse-side tag-scan philosophy; no serializer dependency). `days-view.tsx` wires it to an anchor-download Blob per day. File name `wayborne-<region-slug>-day-<n>.gpx`; route `<name>` reads "Wayborne · <region> · Day n of N". Coordinates emit at 6 decimals, GPX 1.1 namespace, `creator="Wayborne"`.

**6. Exclusions return as data, render as notes.** `excluded` carries `{ name, reason }` per skipped item (untraced segment, ungeocoded stop — today r-035, r-048, s-048). The days view renders them beside the export action using the existing warning furniture. A day whose items yield fewer than two route points has no exportable line; the action disables with the reason inline.

## Risks / Trade-offs

- [Detecht's router deviates from a curated road between entry and exit] → shaping-point constant is the tuning knob; field test on a real device is the acceptance gate; v2 escalation is Valhalla-routed connectors feeding a denser rte.
- [Garmin rejects a structurally sloppy file] → unit tests assert GPX 1.1 structure (namespace, element order, escaping, coordinate bounds) against golden files; manual BaseCamp/zumo import is part of acceptance.
- [Nearest-endpoint chaining mis-orients a segment on a pathological day (e.g., two roads sharing an endpoint region)] → orientation is pure and unit-tested including loop and shared-endpoint cases; a wrong guess is recoverable in Detecht's editor, and the field test watches for it.
- [Rider expects the exact corridor line from the plan view and gets Detecht's re-route] → the export UI copy says whose router owns the line; this is the product's stated position (we influence the route; their nav app owns it).

## Open Questions

- Shaping-point count and placement may need per-segment tuning (long technical roads vs short connectors) after the Detecht field test; v1 ships one constant.
