# Core Planning Flow — Tasks

## 1. Decisions and data foundation

- [x] 1.1 Resolve design.md Open Questions 1 (frame-to-proposal seam) and 2 (tray ruler scope) with Chase; record both in the decision log
- [x] 1.2 Confirm the executed schema is live and RLS-verified (phase-2 step 4 prerequisite); regenerate types with `npx supabase gen types typescript` into `src/lib/database.types.ts`
- [x] 1.3 Add `@supabase/supabase-js` + `@supabase/ssr`; create server and browser client helpers; env vars documented in `.env.example`
- [x] 1.4 Seed region 01 (region row + curated segments/stops from `curation/region-01-catskills-hudson-valley/`) into the Supabase project; verify anon reads return only kept content

## 2. Explore surface

- [x] 2.1 Add `maplibre-gl` as a dynamically imported client island with the Stadia style URL from env; loading state per web-build standards
- [x] 2.2 Render kept segments as character-styled GeoJSON overlays; stops as category symbol layers
- [x] 2.3 Filters with URL-reflected state; zero-results states (computable explanation + plain fallback copy)
- [x] 2.4 Editorial cards: blurb, tags, warnings, single-state `researched` badge, zero-state verification progress bar
- [x] 2.5 Focus-visible treatment applied across all explore interactive elements

## 3. Frame and tray

- [x] 3.1 Frame screen (days × daily mileage), skippable, state + URL persistence; frame-as-ruler propagation
- [x] 3.2 Tray dock: count, running miles vs target, last-added confirmation, ride-order chips, "Build days" bridge
- [x] 3.3 Ruler scope behavior per the 1.1 decision; long-tray overflow behavior chosen, specced, and implemented
- [x] 3.4 Versioned localStorage persistence for frame + tray; restore on reload

## 4. Assembly

- [x] 4.1 Build-days distribution into day legs with per-day meters; move/reorder between days
- [x] 4.2 Warning furniture component family; fuel-gap warnings at the leg with computed gap mileage + day-rail ▲ flag
- [x] 4.3 Connector-leg placeholders visually distinct with estimate-labeled mileage

## 5. Verification

- [ ] 5.1 Component tests for frame math, tray meter scope, day distribution, and localStorage versioning (nextjs-frontend-testing)
- [ ] 5.2 Keyboard pass: focus-visible on every interactive element in the flow
- [ ] 5.3 End-to-end flow check against wireframe v2 (The Flow + States) with real region-01 data; all five states per surface render
- [ ] 5.4 Gamed-pass inspection + fresh-eyes verification per web-build-standards Code Discipline before calling the change done
