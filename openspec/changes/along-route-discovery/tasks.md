# Tasks: along-route-discovery

## 1. Foundations and verification spikes

- [ ] 1.1 Verify Stadia routing in dev: `NEXT_PUBLIC_STADIA_API_KEY` wired from `.env.local`, one Valhalla A-to-B call decoded from polyline to GeoJSON (tiles are keyless on localhost; routing is not)
- [ ] 1.2 Scaffold test: a dozen real Catskills connector legs through Stadia Valhalla `use_highways` (issue #3119 caveat); record pass/fail per leg and any quality surprises in the change dir
- [ ] 1.3 Read the relevant `node_modules/next/dist/docs/` guides before app code (AGENTS.md rule; Context7 quota-blocked for July)

## 2. Data layer

- [ ] 2.1 Migration 00004: `content_near_route(region, line, radius_m)` RPC, SECURITY INVOKER, ST_DWithin 8046.72 m, returns published columns + `off_line_m` + `along_pos` with geometry via the computed geojson path; apply to hosted project via Supabase MCP and commit the file
- [ ] 2.2 Regenerate database types from the live schema
- [ ] 2.3 Verify the RPC as anon on the seeded region: RLS parity (hold/kill/pending absent), plausible off_line_m/along_pos on known stops, EXPLAIN sane on a 78 mi line
- [ ] 2.4 `contentNearRoute()` in `region-content.ts` beside the existing fetch (`geom:geojson` + `overrideTypes` discipline)

## 3. Route entry and storage

- [ ] 3.1 `route-storage.ts`: versioned localStorage envelope, useSyncExternalStore + `use-hydrated` pattern, edit/clear; unit tests
- [ ] 3.2 Map-tap A-to-B: first-tap state, routing-in-flight state, line lands as one LineString (wireframe States A-B)
- [ ] 3.3 Routing failure state: taps kept, plain message, retry + GPX offer, never a fake line (State C)
- [ ] 3.4 GPX import: client-side DOMParser (trk and rte), simplify tracks over ~500 points, unreadable state with working alternative (State D); unit tests on parse + simplify
- [ ] 3.5 Entry always cancellable ("Back to explore"), edit/clear controls in route mode, URL carries route-mode flag only via shallow `history.replaceState`

## 4. Along-route explore (the inversion)

- [ ] 4.1 `explore-view` forks on route-active: milepost-ordered POI-first list, `mi N` labels from along_pos, header count equals rows, loop dedupe at first approach, add-to-trip per row; unit tests on the ordering/derivation
- [ ] 4.2 Inline quiet-stretch and coverage-exit notes at their mileposts (gap threshold + content-envelope heuristic from design decision 6); unit tests on both messages
- [ ] 4.3 Intent chips in route mode: none active by default, chip filters list and map together, chip state never contradicts results
- [ ] 4.4 Map route mode: line + corridor band + endpoints, in-corridor pins full strength, outside dimmed; clearing the route restores the catalog map exactly
- [ ] 4.5 Corridor loading state (never a blank list) and whole-region escape with "Back to your route" (States E, H)
- [ ] 4.6 Motion pass: ~400ms line draw, corridor fades after, one-beat filter swaps, reduced-motion instant

## 5. Verification

- [ ] 5.1 Browser walkthrough of States A-H against wireframe v3 at desktop and 675px
- [ ] 5.2 Keyboard + focus-visible pass on every new interactive element (entry, chips, rows, escape)
- [ ] 5.3 End-to-end journeys in the browser: Kingston→Roscoe happy path (tray adds, Build days untouched), GPX sad path, coverage sad path past the region edge
- [ ] 5.4 `npm test` green including all new tests; fresh-eyes review pass before archive
