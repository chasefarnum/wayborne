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

## Risks / Trade-offs

- [Stadia routing credits may be ~40/request vs the 20 in the older pricing doc] → re-verify the credit table when routing wires up; not exercised in this change.
- [Hosted Valhalla road-class knobs unreliable (issue #3119)] → rely on `use_highways` only for connector legs; nothing in this design depends on finer knobs.
- [Tile burn per planning session unknown] → instrument map loads once the explore surface exists; Protomaps swap trigger is ~75% sustained credit burn.
- [localStorage trip state can be lost across devices] → acceptable for this slice; persistence change follows. Version the localStorage schema from day one so migration is possible.
- [Three explore zones (panel, float card, tray) need discipline] → hierarchy risk flagged at Gate 2; hold the zone boundaries from the wireframe, no new floating surfaces.

## Migration Plan

Schema execution and RLS verification happen before implementation (phase-2 step 4, outside this change). App code lands behind nothing — the repo has no users. Rollback is git revert.

## Open Questions

1. **Frame-to-proposal seam (Gate 2 P2).** Does completing the frame immediately offer "Propose a starting loop", or does explore-first stay deliberate with the skeleton proposal only in the empty-trip state? Recommendation: keep explore-first for this slice (matches the curation-led mental model; the proposal CTA is additive later). Decide before the frame component is built.
2. **Tray ruler scope (Gate 2 P2).** Tray counts the whole trip (of 600) while assembly measures per day (of 200). Recommendation: flip the tray to day-scope once days exist, whole-trip before that. Decide before the tray meter is built.
