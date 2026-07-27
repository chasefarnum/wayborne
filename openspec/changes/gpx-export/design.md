## Context

Days are contiguous slices of the tray's ride order (`distributeDayCounts` in `src/lib/trip.ts`); connectors between curated items are deliberately unrouted. Segments carry full traced LineStrings and stops carry pins, both already reaching the client as GeoJSON via the computed `geojson` columns. The nav benchmark's import contract is documented in the project workspace at `research/detecht-gpx-import-notes.md`: a GPX `<rte>` imports frictionlessly and Detecht re-routes between route points with its own engine; waypoint counts should stay under ~30 per file; exported waypoints are rider-visible and skippable in navigation.

Two prior calls bind this design: the GPX parser is a tolerant tag scan, not DOMParser (design amendment, along-route-discovery), and export must not reintroduce an XML dependency; and Google-derived content or coordinates never persist, so everything exportable is store-friendly by construction.

## Goals / Non-Goals

**Goals:**
- A rider exports one riding day as a GPX 1.1 file that imports into Detecht as an immediately editable, navigable route with named, meaningful points, and into a Garmin.
- Waypoints are locations: one named point per stop, one per curated road (arc-length midpoint on a traced vertex); the nav app's router owns the line between them.
- Honesty holds at the file boundary: anything the file can't carry (untraced segment, ungeocoded stop) is excluded and said out loud in the UI.

**Non-Goals:**
- No routed connector geometry inside the file (Detecht's engine owns the line between our points; Valhalla-routed export is the v2 escalation if midpoint waypoints prove insufficient in the field).
- No whole-trip single file, no `<wpt>` layer in v1 (the mirror `<trk>` exists for importer compatibility, not as a shape carrier).
- No server involvement, no new dependencies, no schema or RPC changes.

## Decisions

**1. Route only — one carrier, and the phone app is the delivery path (settled 2026-07-26 across three field tests).** Round one: rte-only failed Detecht's WEB planner (its server function parses trkpts only; proven by bundle read + A/B). Round two: the dual rte+trk fix imported into the web planner but exposed that path as a dead end regardless — it resamples the line into evenly spaced points and hard-codes `name: null`, destroying both locations and names. Round three: the phone app read BOTH carriers from the dual file and doubled every stop. Verdict: the file carries one named `<rte>` and nothing else; the phone app (GPX route auto-convert, per their docs) is the delivery path; the web planner is documented incompatible and was never able to carry the plan anyway. Detecht labels imported stops with its own reverse-geocoded addresses everywhere — point names are a GPX courtesy for consumers that honor them (Garmin does), not something any file shape can surface inside Detecht.

**2. Waypoints are locations — one per item (amended 2026-07-26, Chase's call on field evidence).** V1 emitted entry/shaping/exit triples per segment to pin the router along the road. The first real import showed what that costs: Detecht's web planner discards our names, reverse-geocodes every point, and renders a wall of duplicate street names — three and four pins per road. Chase's direction: feed it locations and let Detecht do the rest. Each stop emits one point named after the stop; each segment emits ONE point named after the road, on the traced vertex nearest its arc-length midpoint (a real vertex, never interpolated, so the point sits on the road and pulls the route onto it). No orientation logic, no shaping constants, no point budget — a day's file carries exactly as many points as it has located items. Accepted trade-off: a midpoint guarantees the router touches the road, not that it rides it end to end; if the ride test shows a road getting clipped, the escalation is selective extra points on that road, not a return to triples.

**3. Builder is a pure function; download is a Blob.** `src/lib/gpx.ts` exports `buildDayGpx(...)` returning `{ xml, excluded, pointCount }` — no React, no fetch, string assembly with manual XML escaping (mirror of the parse-side tag-scan philosophy; no serializer dependency). `days-view.tsx` wires it to an anchor-download Blob per day. File name `wayborne-<region-slug>-day-<n>.gpx`; route `<name>` reads "Wayborne · <region> · Day n of N". Coordinates emit at 6 decimals, GPX 1.1 namespace, `creator="Wayborne"`.

**4. Exclusions return as data, render as notes.** `excluded` carries `{ name, reason }` per skipped item (untraced segment, ungeocoded stop — today r-035, r-048, s-048). The days view renders them beside the export action using the existing warning furniture. A day whose items yield fewer than two route points has no exportable line; the action disables with the reason inline.

## Risks / Trade-offs

- [The router clips a curated road it only touches at the midpoint] → ride-test watched; escalation is selective extra points on the offending road, then Valhalla-routed connectors as the v2 path.
- [Garmin rejects a structurally sloppy file] → unit tests assert GPX 1.1 structure (namespace, element order, escaping, coordinate bounds) against golden files; manual BaseCamp/zumo import is part of acceptance.
- [Rider expects the exact corridor line from the plan view and gets Detecht's re-route] → the export UI copy says whose router owns the line; this is the product's stated position (we influence the route; their nav app owns it).

## Open Questions

- Whether a single midpoint waypoint holds Detecht's router on long or convoluted roads end to end; the ride test decides, and selective extra points per road are the tuning knob.
