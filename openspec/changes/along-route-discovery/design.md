# Design: along-route-discovery

## Context

core-planning-flow shipped the explore catalog, trip tray/frame/days, and localStorage trip persistence (all archived, specs synced). Stops are geocoded (65/66) and pins render through the computed `geojson` columns (migration 00003; PostgREST serves geography as WKB hex, so every geometry read uses `select "geom:geojson"` + `overrideTypes`). Road `geom` is still null; segment tracing runs as a parallel data task.

This change adds the route-spine mode designed in wireframe v3 (`~/claude/projects/personal/wayborne/wireframes/1707-along-route-v1/`, gates passed 2026-07-18). The think doc (`brief/wayborne-along-route-think-v1.md`) fixed scope: four MUSTs, no more.

## Goals / Non-Goals

**Goals:**
- A rider gets a line into Wayborne in two taps or one GPX import, and sees curated content in ride order with honest off-line distances.
- The corridor query is one RPC round-trip and respects existing RLS exactly.
- Route mode is a fork of explore, not a rewrite: trip provider, tray, frame, days untouched.
- Every state in wireframe v3 (A through H) renders; nothing blank, nothing fabricated.

**Non-Goals:**
- Turn-by-turn (never, standing decision). Server-side route storage or share links (trip-persistence change). Computed detour times. Geocoder text entry. Freehand draw. Via-points and corridor-coverage indicator (SHOULDs, cut from v1).

## Decisions

1. **The rider's line is one GeoJSON LineString, stored client-side.** Versioned localStorage module (`route-storage.ts`) following the `trip-storage.ts` discipline (versioned envelope, `use-hydrated`, useSyncExternalStore). The URL carries only a `route=1` mode flag via the shallow `history.replaceState` pattern; the line itself is too big for params. The "never merge into one LineString" rule governs curated compositions over `route_segments`, not the rider's own line (think-doc tech check).
2. **Corridor math lives in Postgres, not the client.** Migration 00004 adds `content_near_route(region uuid, line jsonb, radius_m float8)` RETURNS TABLE, SECURITY INVOKER so it selects through the existing anon/rider/curator policies. Per row: the published columns explore already reads (geojson included) plus `off_line_m` (ST_Distance) and `along_pos` (ST_LineLocatePoint on the geography cast). Filter: ST_DWithin only, radius 8046.72 m. Alternative rejected: client-side turf.js buffering — duplicates PostGIS, adds a dependency, and drifts from the RLS-governed read path.
3. **Route entry is client-side.** Map-tap A-to-B calls Stadia Valhalla (costing endpoint `auto`; the 1.2 scaffold confirmed default auto is the right call for fast connectors, and `use_highways=0.1` cleanly avoids motorways when that option ever surfaces), polyline-decoded to GeoJSON in the client. GPX import parses client-side with no new packages; tracks over ~500 points are simplified client-side (Douglas-Peucker) before storage and querying. _Amended 2026-07-18 during build:_ parsing uses a tolerant attribute-tag scan rather than DOMParser — identical behavior in the browser and in node unit tests (task 3.4 requires them; jsdom would be a new dependency), and GPX points are attribute-based so tag scanning is reliable; a file yielding no readable points lands in the unreadable state exactly as a parse failure would. _Also amended:_ `NEXT_PUBLIC_STADIA_API_KEY` is optional in dev — Stadia's localhost exemption covers the routing API (verified, `verification/stadia-valhalla-scaffold.md`); the client appends the key only when the env var is present, and production needs it before launch.
4. **explore-view forks on route-active; nothing else does.** `explore-view.tsx` renders the catalog (today) or the along-route list (route active). `region-content.ts` gains a `contentNearRoute()` beside the existing fetch. `explore-map.tsx` gains route/corridor layers and a dim state for out-of-corridor pins. `filter-chips.tsx` gains the intent-chip set in route mode (default: none active; chips filter list and map together — the shown state never contradicts the shown results, gate verdict ④).
5. **Milepost list is derived, not stored.** Sort by `along_pos`; label `mi N` from along_pos × line length. Quiet-stretch notes are computed client-side: a gap over ~15 mi between consecutive results renders the inline note row (gate verdict ⑨). Loop routes: dedupe per stop at minimum `along_pos` (first approach). Untraced roads near the line (matched by their stop-like anchor if any) render the placeholder row only when the corridor RPC returns them; until tracing lands, segments with null geom simply don't match — the placeholder row ships with tracing, not before.
6. **Coverage honesty comes from the content envelope, not a region polygon.** The schema has no region boundary. The exit milepost is derived client-side: past the last along_pos where published content exists within the corridor, if the line continues more than ~10 mi, render the leaves-region note at that milepost. Honest, cheap, no schema change. Revisit if regions ever get real polygons.
7. **Motion per wireframe motion notes.** Line draws in ~400ms after routing resolves; corridor fades up after; filter changes swap list and pins in one beat. Reduced motion: instant swaps. Nothing essential.

## Risks / Trade-offs

- [Stadia Valhalla quality or key friction embarrasses the entry flow] → The dozen-leg Catskills `use_highways` scaffold test is a verification task in this change, run before the UI work hardens; routing failure state (C) keeps taps and offers GPX.
- [Huge GPX tracks (9k+ points) stall parse/query] → Client-side simplification cap before storage; the RPC receives the simplified line only.
- [RPC slow on long lines] → ST_DWithin with the existing GiST indexes; the line arrives pre-simplified; region filter first. Verify with EXPLAIN on the seeded region as a task.
- [Content-envelope exit heuristic misfires on genuinely quiet in-region stretches] → The two notes are worded differently (quiet stretch vs coverage ends) and the quiet-stretch note wins inside the envelope; threshold tuned against the Kingston–Albany journey from the think doc.
- [explore-view fork grows into two divergent screens] → The fork is at list/chips level only; cards, badges, add-to-trip, map island, and trip surfaces are shared components.

## Migration Plan

1. Migration 00004 (`content_near_route` RPC) applied to hosted project `ptfrcvbhokfbjftjxjfn` via the Supabase MCP, same flow as 00003, and committed to `supabase/migrations/`.
2. Rollback: `drop function content_near_route;` — no tables touched, no data at risk.
3. App changes ship behind the route-mode flag; no route set means today's explore, byte-for-byte behavior.

## Open Questions

- None blocking. Chip taxonomy behind "More filters" (full taxonomy vs none at all) can be settled during build; wireframe says "demoted behind disclosure if at all."
