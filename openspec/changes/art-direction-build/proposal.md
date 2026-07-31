# Art Direction Build Pass

## Why

The art direction is locked (2026-07-27, `research/inspiration/wayborne-art-direction-v1.md`, five rounds with Chase, design-review 8/10 GO) but the shipped app still wears the superseded eighth-session system: warm stone grounds, the retired center-line yellow accent, and 10px-family radii. The build pass translates the direction board's reference implementation (`design/direction-board-v1.html` section 06) into real tokens and components so the product stops reading as generic React and starts reading as Wayborne.

## What Changes

- **Token layer rebuilt** in `globals.css`: cool UI grounds (`#0a0a0b` ground / `#141416` panel / `#232326` line) replace warm stone on working screens; single accent paint orange `#c9611e` replaces yellow everywhere it lives (shell double line, active nav, CTAs, map markers, ridden patches); radii sharpen to 2-4px (cards/buttons 3px, chips/patches 2px, dock 4px, no pills); signal red `#B23A2E` tokenized for warnings only. **BREAKING** for the visual layer: every surface changes appearance; no behavior changes.
- **Two-ground discipline tokenized**: warm stone (grain allowed) survives only for brand surfaces (covers, badges, empty states); cool family (no grain, ever) owns working screens. The two never mix on one surface.
- **Swap seams built**: display type mounts behind `--font-display` (Rye interim; Chase supplies the real face later) and the logo becomes a single swappable component (compass stamp + tracked caps interim; real logo later). Replacement is config, not rework.
- **Motif components per board section 06**: rail road cards (panel logic, inset hairline), provenance patch chips (RIDDEN dashed rust / RESEARCHED plain), day-ribbon headers in the days view, map chips, floating dock.
- **Review P2s folded in**: signal red gets its first job as the closure warning chip; Explore empty/loading states get Mann sky plates with the circular stamp badge.
- **Heritage budget enforced**: max three heritage touches per working screen (board 06 reference allocation: double-line rule, Rye masthead, provenance patch); Rye never sets UI labels; grain never on UI surfaces.

## Capabilities

### New Capabilities

- `visual-system`: the tokenized art-direction layer — grounds, accent, radii, type seams, logo seam, motif components (patches, ribbons, panel borders, sky plates), and the discipline rules (two grounds never mix, heritage budget, grain scope, accent scarcity).

### Modified Capabilities

None. No existing spec (`along-route-explore`, `curation-data-access`, `explore-map`, `route-entry`, `trip-assembly`, `trip-frame`, `trip-tray`) encodes visual identity at the requirement level; behavior, flows, and data contracts are untouched.

## Impact

- **Code**: `src/app/globals.css` (token rewrite), `src/app/layout.tsx` (font loading, `--font-display`), `src/components/frame/*` (shell, nav, logo seam), `src/components/explore/*` (rail cards, filter chips, empty/loading states, map chips), `src/components/trip/*` (day ribbons, dock), `src/components/ui/*` (radii, accent propagation via tokens).
- **No API, database, or dependency changes** beyond adding the Rye (and possibly Yellowtail) Google font via `next/font`.
- **Map layer**: marker/route accent colors in `explore-map.tsx` move from yellow to paint orange; basemap (`alidade_smooth_dark`) and bone route line unchanged.
- **Verification**: browser side-by-side against the direction board; existing 97 tests and `tsc` stay green (no logic touched).
