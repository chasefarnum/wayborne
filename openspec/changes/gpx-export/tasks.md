# Tasks — gpx-export

## 1. Pure builder (`src/lib/gpx.ts`)

- [x] 1.1 Point derivation: types for the builder's inputs (day items resolved to name + geometry), stop → one named point, segment → entry/shaping/exit points with start–end naming; shaping interior points evenly spaced by arc length (`SHAPING_POINTS_PER_SEGMENT = 1`)
- [x] 1.2 Orientation: nearest-endpoint chaining with a moving anchor; first-item-is-segment orients against the next located item; no-anchor fallback keeps traced direction (reuse haversine from `route.ts`)
- [x] 1.3 Point budget: shaping collapses shortest-segment-first while total > 30; essential points never dropped
- [x] 1.4 XML assembly: GPX 1.1 namespace, `creator="Wayborne"`, route name "Wayborne · <region> · Day n of N", manual escaping, 6-decimal coordinates; `buildDayGpx` returns `{ xml, excluded, pointCount }`
- [x] 1.5 Exclusions: untraced segments and ungeocoded stops land in `excluded` with `{ name, reason }`; fewer than two points → no xml, reason returned

## 2. Builder tests (`src/lib/gpx.test.ts`)

- [x] 2.1 Structure tests: well-formed GPX 1.1 against a golden file, escaping of `&`/`<`/quotes, coordinate precision, file/route naming
- [x] 2.2 Derivation and orientation tests: mixed stop/segment day in ride order, segment-follows-stop orientation, day-opens-with-segment orientation, no-anchor fallback, loop and shared-endpoint cases
- [x] 2.3 Budget and exclusion tests: shaping collapse order at the 30-point boundary, essential points never dropped, excluded items reported (r-035/r-048/s-048-shaped fixtures), nothing-exportable day

## 3. Days view wiring (`src/components/trip/days-view.tsx`)

- [x] 3.1 Per-day Export GPX action: resolve the day's refs to geometry from region rows, call `buildDayGpx`, download via Blob as `wayborne-<region-slug>-day-<n>.gpx`
- [x] 3.2 Exclusion notes render beside the export action using existing warning furniture; disabled state with inline reason when nothing is exportable; copy says Detecht's router owns the line between points
- [x] 3.3 Action states (exportable, with exclusions, disabled) covered at the lib level — the repo has no component-test infra (vitest is node-only, no jsdom/RTL) and the wiring stays thin enough that `buildDayGpx`'s result union carries every state the UI renders; full suite + typecheck green

## 4. Acceptance (manual, gates archive)

- [ ] 4.1 Field test: import a real Catskills day into Detecht — route auto-opens editable, points named as specced, curated roads held on the line; tune `SHAPING_POINTS_PER_SEGMENT` if the router deviates
- [ ] 4.2 Garmin test: same file imports into BaseCamp/a Garmin unit without complaint
