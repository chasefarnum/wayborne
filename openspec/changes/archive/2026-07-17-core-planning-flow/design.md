# Core Planning Flow — Design

## Context

The repo is a fresh Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui (radix-nova) scaffold. The schema (`supabase/migrations/00001_init.sql`, geography(4326) spatial columns) executes against a free-tier Supabase project before implementation starts; RLS is verified as anon, rider, and curator. Wireframe v2 at `../../wireframes/1407-core-planning-flow-v2/` is the build source of truth (v1 is the option-set record, do not build from it). Placeholder palette and deferred type are intentional until branding opens.

Standing geo rules (from stack validation, not preference): ST_DWithin only — never ST_Buffer, never ST_Distance in a WHERE clause; the 5-mile radius is 8046.72 meters; never merge a route into one LineString — join per segment over `route_segments`.

## Goals / Non-Goals

**Goals:**
- The explore → frame → tray → assembly flow working end to end against real region-01 data.
- Provenance honesty in the UI: single-state `researched` badges, zero-state verification progress bars, nothing faked as `verified`.
- The five Gate 2 build-time items implemented (two of them decided first — see Open Questions).

**Non-Goals:**
- GPX export, weather, share links, email capture, curation review queue (each is its own change).
- Turn-by-turn navigation (never — Detecht owns it).
- Trip persistence to the database and auth UI (see Decisions; deferred to a `trip-persistence` change).
- Free-form twisty-route generation (v2, GraphHopper trigger).

## Decisions

1. **Trip state is client-side for this slice.** The tray and assembled days live in React state persisted to localStorage; no auth wall in front of the core flow. DB-backed trips (`trips`/`trip_legs`/`trip_leg_items` + Supabase Auth) come as their own `trip-persistence` change. Why: the flow must be provable with zero sign-up friction, and it keeps this change free of auth surface. The schema seam is already in place, so persistence later is wiring, not modeling.
2. **Data access via `@supabase/ssr`.** Server components fetch region content (segments, stops, region card) with the anon key; RLS is the gate, not app logic. Generated types (`npx supabase gen types typescript`) keep queries typed. Geo filters needing PostGIS functions go through Postgres RPCs so ST_DWithin stays server-side; this slice needs at most region-scoped fetches, so plain PostgREST filters cover it.
3. **Map is a dynamically imported client island.** `maplibre-gl` loads via `next/dynamic` (no SSR) to keep it out of the initial bundle; Stadia style URL from env. Segment overlays render from stored geometry as GeoJSON sources; character tags drive layer styling; stops are filterable symbol layers.
4. **State in the URL where the wireframe implies deep-linking.** Active filters, selected stop/segment, and frame values reflect into query params so explore states are shareable and back-button safe.
5. **Warning furniture is one component family.** Fuel gaps, enforcement, and closures share the same warn primitive (per Gate 1: "same warning furniture"); the day rail's compact ▲ flag is a variant, not a second pattern.
6. **Routing is not wired in this change.** Connector legs between tray items display as straight-line placeholders with mileage from curation data; Stadia Valhalla wiring (with the dozen-leg `use_highways` Catskills test) lands with routing work, keeping this slice honest about what is computed vs illustrative.
7. **Frame-to-proposal seam: explore-first stays deliberate** (decided by Chase 2026-07-15). Completing the frame lands in explore; the skeleton proposal surfaces only via the empty-trip state. A "Propose a starting loop" CTA at framing is additive later if planning data shows riders stall in explore.
8. **Tray ruler scope: whole-trip before days exist, day-scope after** (decided by Chase 2026-07-15). The tray meter counts the trip (of 600) until "Build days" runs, then flips to the active day's scope (of 200) so the tray and assembly never show two rulers at once.
9. **Long-tray overflow: single-row horizontal scroll** (chosen at implementation per task 3.3, 2026-07-17). The ride-order chips live in one horizontally scrolling row with the count/miles stat block and "Build days" pinned outside the scroller, so both stay visible at any item count and every chip stays reachable by scroll or keyboard focus. New items scroll into view on add. Chosen over collapse (hides ride order, the tray's whole point) and count-only (kills direct chip selection); the scroller engages naturally at any width, so 30+ items is a non-event rather than a mode switch.
10. **Fuel gaps are computed structurally from the plan** (chosen at implementation per task 4.2, 2026-07-17). No station data exists and curation range notes are prose, so the one computable, never-illustrative reading of the spec is to measure the rider's actual day: a run of consecutive curated segments with no stop planned between them warns when its curated lengths sum to 40+ mi (threshold set so the region's benchmark ~45-mi Margaretville-to-Walton gap triggers). The copy says "at least" because connectors are unrouted, so the true distance can only be longer. When station or structured range data lands, the same warning furniture upgrades in place.
11. **Connectors show no mileage until routing** (chosen at implementation per task 4.3, 2026-07-17). Every `geom` is still untraced, so there is no straight-line distance to compute and no honest number to label as an estimate. The placeholder states exactly what the day's count excludes ("not routed yet · miles not counted") instead of fabricating a figure. Estimate-labeled mileage arrives with routing, or with traced geometry at minimum.
12. **Days are per-day counts over the ride order** (chosen at implementation per task 4.1, 2026-07-17). `dayCounts` partitions the tray's flat ride order into contiguous slices, so the tray chips and the day legs can never disagree, and one move primitive covers both gestures: inside a day it swaps neighbors, at a day edge it shifts the boundary. Distribution walks ride order greedily against the daily target, and a night stop closes its day (legs end where you sleep). Dismissing the frame sheet while unframed records a skip, keeping "no silent default" intact now that the frame is a dialog.

## Risks / Trade-offs

- [Stadia routing credits may be ~40/request vs the 20 in the older pricing doc] → re-verify the credit table when routing wires up; not exercised in this change.
- [Hosted Valhalla road-class knobs unreliable (issue #3119)] → rely on `use_highways` only for connector legs; nothing in this design depends on finer knobs.
- [Tile burn per planning session unknown] → instrument map loads once the explore surface exists; Protomaps swap trigger is ~75% sustained credit burn.
- [localStorage trip state can be lost across devices] → acceptable for this slice; persistence change follows. Version the localStorage schema from day one so migration is possible.
- [Three explore zones (panel, float card, tray) need discipline] → hierarchy risk flagged at Gate 2; hold the zone boundaries from the wireframe, no new floating surfaces.

## Migration Plan

Schema execution and RLS verification happen before implementation (phase-2 step 4, outside this change). App code lands behind nothing — the repo has no users. Rollback is git revert.

## Open Questions

_None. The two Gate 2 P2 seams were decided 2026-07-15 and moved to Decisions 7 and 8._
