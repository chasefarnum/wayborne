# Proposal: along-route-discovery

## Why

The rider arrives with intent: a rough line, an A-to-B, or a route already living in their nav app. Today's explore surface makes them browse a region catalog and do the route-relative math themselves. This change inverts explore around the rider's line so Wayborne does its actual job (route-spine Ask, signed off 2026-07-17): surface the curated stops and roads worth bending that line for.

Scope source of truth: `~/claude/projects/personal/wayborne/brief/wayborne-along-route-think-v1.md` (think-before-build, Chase signed off on the three calls) and wireframe v3 `wireframes/1707-along-route-v1/` (design-review + product-design-critique gates passed 2026-07-18, verdicts folded in). Do not re-derive scope.

## What Changes

- New route entry surface: map-tap A-to-B routed by Stadia Valhalla, and client-side GPX import. No geocoder text fields, no freehand draw (signed-off call 1).
- New corridor query: one Postgres RPC (`content_near_route`, migration 00004) returning curated stops and traced segments within 5 mi (ST_DWithin, 8046.72 m) of the rider's line, with off-line distance and position along the route.
- Explore inverts when a route is active: milepost-ordered "Along your way" list (POI-first, off-line distances, quiet-stretch notes inline), intent-level filter chips, map shows line + corridor with out-of-corridor content dimmed. Corridor-only results with a single "show the whole region" escape (signed-off call 2).
- Roads appear as quiet untraced placeholders until segment tracing lands; stops ship first (signed-off call 3).
- Route persists in versioned localStorage with edit/clear; URL carries a route-mode flag only.
- Tray, frame, and Build days are untouched; along-route feeds the same trip.

## Capabilities

### New Capabilities

- `route-entry`: how a rider gets a line into Wayborne: map-tap A-to-B via Stadia Valhalla, GPX import parsed client-side (long tracks simplified), local persistence (versioned localStorage), edit/clear, and every entry state (first tap, routing in flight, routing failed, GPX unreadable).
- `along-route-explore`: the inverted explore mode when a route is active: corridor results in milepost order with off-line distances, intent filters, quiet-stretch and coverage-honesty notes, whole-region escape, corridor map presentation (line, corridor band, dimmed outside), and untraced-road placeholders.

### Modified Capabilities

- `curation-data-access`: gains the route-corridor read path: `content_near_route(region, line, radius_m)` RPC (SECURITY INVOKER, selects through existing RLS policies) returning `off_line_m` and `along_pos` per row. Reads continue through computed `geojson` columns.
- `explore-map`: the map contract gains a route mode: rider's line rendered as one LineString, ~5 mi corridor band, in-corridor pins full-strength, out-of-corridor dimmed, route endpoints. (No change to base layers or pin categories.)

## Impact

- **Code**: real surgery in `explore-view` (list forks on route-active); new route-entry components; new route storage module (`use-hydrated` pattern); `region-content.ts` gains the RPC path; map island gains route/corridor layers. Trip provider, tray, frame, days: no changes.
- **Database**: migration 00004 adds the `content_near_route` RPC. No schema/table changes, RLS untouched.
- **Services**: Stadia Valhalla routing call (client-side, polyline-decoded). Requires `NEXT_PUBLIC_STADIA_API_KEY` in dev; tiles are keyless on localhost but routing is not. The dozen-leg Catskills `use_highways` scaffold test folds into this change's verification.
- **Dependencies**: none anticipated (GPX via DOMParser). Anything new asks first.
- **Standing rules**: planning-only forever; ST_DWithin only; the rider's line is legitimately one LineString (their data, not a curated composition); Google content/coordinates never persisted.
