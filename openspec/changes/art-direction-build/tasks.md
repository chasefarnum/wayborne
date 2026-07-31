# Tasks — Art Direction Build Pass

## 1. Token layer

- [x] 1.1 Rewrite `.dark` tokens in `globals.css` to the cool family (ground `#0a0a0b`, panel `#141416`, line `#232326`, text `#e7e5e4`, dim `#8e8e93`, input ground `#0f0f10`), converted to oklch with source hex in comments; `--shell` joins the cool family
- [x] 1.2 Repurpose `--brand` to paint orange `#c9611e` (light + dark), `--brand-foreground` to near-black; add `--signal` `#b23a2e` and brand-surface tokens (`--ground-brand`, `--panel-brand`, `--bone`, `--bone-dim`, `--rust`) with `@theme inline` mappings
- [x] 1.3 Replace the radius multiplier scale with literals: sm 2px, md 3px, lg 3px, xl+ 4px; audit and fix `rounded-full`/pill usages (circular exceptions allowed)
- [x] 1.4 Load Rye in `layout.tsx` via `next/font` behind `--font-display`; map a `font-display` utility in `@theme inline`
- [x] 1.5 Add `.panel-card` (inset hairline + hover warm) and `.sky-mann` (dusk gradient, brand surface) utilities to `globals.css`; scope grain comment to brand surfaces
- [x] 1.6 Verify: `npx tsc --noEmit` + `npm test` green; app renders coherently on cool grounds with orange accent

## 2. Shell and logo seam

- [x] 2.1 Create `src/components/frame/logo.tsx` (compass-stamp SVG + tracked WAYBORNE caps, size prop); consume it in `app-shell.tsx`
- [x] 2.2 Remove `texture-grain` from the shell header; double line renders paint orange on the cool shell ground

## 3. Explore components (board 06)

- [x] 3.1 Create `PatchChip` (RIDDEN dashed paint-orange / RESEARCHED plain) and swap it for the provenance `Badge` on segment and stop cards; apply `.panel-card` classes to rail cards
- [x] 3.2 Restyle map filter chips per board (3px, translucent ground, blur, active = orange fill / near-black text)
- [x] 3.3 Add the map masthead (rust-caps region eyebrow + `font-display` region name) to the Explore map
- [x] 3.4 Move MapLibre waypoint/stop circle fills to `#c9611e` with near-black stroke; route line, corridor, and earth-tone data colors untouched
- [x] 3.5 Sky plates: rail no-results empty state and map loading state render `.sky-mann` panels with the circular stamp and serif-italic copy (run copy through the anti-AI pass)

## 4. Trip components

- [x] 4.1 Create `DayRibbon` (bone band, rust clip-path ends) and use it for day headers in `days-view.tsx`
- [x] 4.2 Restyle `tray-dock.tsx` floating dock per board (4px radius, translucent cool ground, hairline border, orange CTA)

## 5. Warnings

- [x] 5.1 Move `Warn`/`WarnFlag` to `text-signal`; add `WarnChip` (2px, signal border/text) and apply it to closure/seasonal warnings on road cards

## 6. Verification gate

- [x] 6.1 Browser-verify Explore and Days side-by-side against `design/direction-board-v1.html` section 06 (headless-Chrome CLI capture, not chrome-devtools screenshot, per HANDOFF gotcha); confirm heritage budget ≤3 per screen, no grain on working surfaces, zero yellow remaining (grep + visual)
- [x] 6.2 Contrast check: active nav, patch text, CTA text vs WCAG 3:1 UI minimum; lift RIDDEN text tone if it fails at 9px
- [x] 6.3 Full suite green (`npm test`, `npx tsc --noEmit`); `openspec validate --change art-direction-build` passes
