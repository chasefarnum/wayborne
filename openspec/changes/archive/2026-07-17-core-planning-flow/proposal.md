# Core Planning Flow

## Why

Wireframe v2 (`../../wireframes/1407-core-planning-flow-v2/`) passed both pre-build gates on 2026-07-14 and the stack is locked (`research/wayborne-stack-validation-v1.md`). This change turns the validated design into the first working product slice: a rider explores curated Catskills/Hudson Valley roads and stops on a map, frames a trip (days × daily mileage), collects segments and stops into a tray, and assembles them into rideable daily legs. It also carries the five Gate 2 build-time items as requirements so they are implemented, not lost.

## What Changes

- Explore surface: MapLibre GL map (Stadia tiles) with curated road segments as character-tagged overlays, stops as filterable layers, editorial cards with provenance badges (`researched` / `verified`) and blurbs.
- Trip frame: skippable time-box entry (days × daily mileage target) that becomes the ruler for the tray, day meters, and the empty-trip proposal. Gate 2 P2 decision folded in: the frame-to-proposal seam (whether framing immediately offers "Propose a starting loop").
- Trip tray: dock under explore with count, running miles vs the framed target, last-added confirmation, ride-order chips, "Build days" bridge. Gate 2 P2 decision folded in: tray ruler scope (whole-trip vs day-scope once days exist). Gate 2 P3 folded in: long-tray behavior at 30+ items.
- Trip assembly: day-by-day legs with per-day mileage meters, fuel-gap warnings at the leg using the same warning furniture as enforcement/closures.
- Data access: Supabase client + typed queries over the executed schema, RLS-respecting (anon browse of published free-region content; rider-owned trips), geo queries via ST_DWithin only (8046.72 m radius), routes joined per segment over `route_segments`, never merged LineStrings.
- Cross-cutting from Gate 2: focus-visible treatment specified and applied to every interactive element (P2); zero-results fallback copy when no explanation is computable (P3).

Out of scope for this change: GPX export, weather-on-dates, share links, email capture/landing page, curation review queue UI. Each is its own change.

## Capabilities

### New Capabilities

- `explore-map`: map rendering, curated segment overlays, stop layers and filters, editorial cards, provenance display, zero-results behavior.
- `trip-frame`: time-box entry, skip path, frame-as-ruler propagation, frame-to-proposal seam.
- `trip-tray`: add-to-trip destination, running meter, ride-order chips, ruler scope, long-tray overflow.
- `trip-assembly`: day building, per-day meters, fuel-gap and hazard warnings at the leg.
- `curation-data-access`: Supabase data layer, RLS-respecting query patterns, geo query rules.

### Modified Capabilities

_None — first change in the repo; no existing specs._

## Impact

- New app code across `src/` (App Router routes, map components, tray/assembly state).
- New dependencies: `maplibre-gl`, `@supabase/supabase-js` (+ `@supabase/ssr`). Flag any additions beyond these before installing.
- Requires the executed Supabase schema (`supabase/migrations/00001_init.sql`, geography(4326) columns) and env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, Stadia style URL/key).
- Region 01 curation dataset seeds the content (all `researched`; zero-state verification progress is deliberate and must not be faked).
