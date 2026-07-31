# Design — Art Direction Build Pass

## Context

The locked direction (`research/inspiration/wayborne-art-direction-v1.md`, rounds 1-5) and its reference implementation (`design/direction-board-v1.html` section 06) define a 90% modern chassis / 10% heritage ink system: cool neutral-black working screens, one paint-orange accent, 2-4px radii, heritage rationed to three touches per working screen. The shipped app runs the superseded system: warm stone grounds (`--shell` oklch stone-950), center-line yellow `--brand`, shadcn's default 0.625rem radius scale, `rounded-xl` cards, and provenance as plain outline Badges. The app is dark-first (`dark` class hardcoded on `<html>`); light tokens exist but are unused.

Board section 06 values (authoritative): UI ground `#0a0a0b`, panel `#141416`, line `#232326`, text `#e7e5e4`, dim `#8e8e93`; accent `#c9611e`; bone `#ede0c8`; rust `#b5651d`; signal red `#b23a2e`; search/input ground `#0f0f10`; card hover border `#3a3a3e`; radii: chips/patches 2px, cards/search/map-chips 3px, dock 4px.

## Goals / Non-Goals

**Goals:**
- Every working screen wears the cool ground family and the single paint-orange accent; zero yellow remains.
- The board's motif components exist as real React components: road-card panel logic, provenance patches, day ribbons, map chips, floating dock treatment, map masthead.
- Signal red gets its first job (closure/warning chip); Explore empty/loading states get Mann sky plates with the circular stamp.
- Display font and logo mount behind swap seams (`--font-display`, one `Logo` component) so Chase's real assets drop in as config.
- The discipline rules are encoded structurally where possible (tokens for both grounds, grain scoped to a class that working surfaces never carry).

**Non-Goals:**
- No behavior, flow, data, or routing changes. No test-logic changes (assertions on classNames may need updating only if any test asserts styles; none are known to).
- No region covers, badge suite at full scale, pinstripe SVG flourish library, or regional flourish kit (later ship-order stages).
- No light mode design pass: the app stays dark-first; light tokens remain defined but are not re-designed.
- No hand-lettered wordmark or purchased font kits.

## Decisions

**1. Repurpose `--brand`, don't rename it.** The accent token keeps its name and every existing `bg-brand`/`text-brand` usage; only the value changes from yellow (oklch 0.83 0.16 84) to paint orange `#c9611e` (oklch ≈ 0.62 0.13 55). Alternative — introducing `--paint` and migrating call sites — adds churn with no benefit: "brand" is the correct semantic name for the one system accent. `--brand-foreground` flips to the cool ground `#0a0a0b` (board: accent surfaces carry near-black text).

**2. The dark theme becomes the cool family; warm stone moves to explicit brand-surface tokens.** `.dark` (the live theme) rewrites to: background `#0a0a0b`, card/popover `#141416`, border/input `#232326`, foreground `#e7e5e4`, muted-foreground `#8e8e93`, secondary/muted `#0f0f10`-family. `--shell` (the topbar ground) joins the cool family — the board's shell is `#0a0a0b` with the double paint-orange line, not warm stone. New tokens carry the warm ground forward for brand surfaces only: `--ground-brand` (stone-950), `--panel-brand` (stone-900), `--bone` `#ede0c8`, `--bone-dim` `#c9bda6`, `--rust` `#b5651d`, mapped in `@theme inline` so `bg-ground-brand`, `text-bone`, etc. exist. This tokenizes the design-review P1: the two grounds are separate named tokens, and a surface picks one.

**3. Radius scale goes literal: sm 2px / md 3px / lg 3px / xl 4px; larger steps clamp to 4px.** The shadcn multiplier formula (`calc(var(--radius) * n)`) is replaced with fixed values — the locked spec is absolute pixel values, not a ratio, and no pill may survive at any step. Existing `rounded-xl` on cards resolves to 4px automatically, but cards are re-classed to `rounded-md` (3px) to match the board. Grep-audit for `rounded-full` (pills banned; exceptions: genuinely circular elements like map waypoint dots and the compass stamp).

**4. `--font-display` seam via `next/font` Rye.** `layout.tsx` loads Rye (weight 400, `variable: "--font-display-face"`); `globals.css` maps `--font-display: var(--font-display-face)` and `@theme inline` exposes `--font-heading` unchanged (Barlow) plus new `font-display` utility. Only mastheads use `font-display`; the swap is one variable reassignment when Chase's face arrives. Rye never appears in a class applied to UI labels — enforced by usage (only the map masthead and future covers), documented in the token comment.

**5. One `Logo` component (`src/components/frame/logo.tsx`).** Compass-stamp SVG (board section 06 topbar: two concentric circles + four spokes) + WAYBORNE in tracked Barlow caps, accepting a `size` prop. `AppShell` consumes it; nothing else composes wordmark markup inline. Chase's real logo replaces the component's internals only.

**6. Provenance patches replace outline Badges on cards.** New `PatchChip` component: RIDDEN — dashed `1px dashed rgba(201,97,30,.6)` border, paint-orange text, 2px radius, `rgba(201,97,30,.07)` fill; RESEARCHED — solid `--ui-line`-style border, dim text. 9-10px tracked caps per the board. It reads from the existing `provenance` field (`verified` → RIDDEN, `researched` → RESEARCHED — display language per the board; data values unchanged).

**7. Road cards adopt panel logic via a `::before` inset hairline.** A `.panel-card` utility (globals.css): 3px radius, panel ground, hairline border, inset `rgba(237,224,200,.14)` hairline at 7px that warms to `rgba(201,97,30,.5)` on hover. Applied to Explore rail cards (segment + stop). This is CSS-only; the card components swap classes, not structure.

**8. Day ribbons are a `DayRibbon` component, and they are the days view's one heritage touch.** Bone band, tracked caps in near-black, rust clip-path ends per board section 04. Used for the per-day headers in `days-view.tsx` (the `Day N` markers). The days view's heritage budget: ribbon + double line (shell) = 2; nothing else added.

**9. Map furniture per board 06.** Map chips (filter toggles): 3px radius, `rgba(10,10,11,.85)` ground, backdrop-blur, active = paint-orange fill with near-black text. Floating dock (`tray-dock.tsx`): 4px radius, `rgba(10,10,11,.9)` + blur, hairline border. Map masthead (new, Explore): eyebrow `REGION 01` in tracked rust caps + `THE CATSKILLS` in `font-display` — this is the Explore screen's Rye touch. Explore heritage budget: double line + masthead + patches = 3, at cap; nothing else added. MapLibre paint: waypoint/stop circle fills move `#fafaf9` → `#c9611e` with near-black stroke (board shows paint-orange waypoints); the bone route line `#fafaf9` and corridor `#2c2a27` stay; character-tag earth-tone data colors in `lib/explore.ts` stay untouched (standing rule).

**10. Signal red's first job: the closure chip.** Token `--signal` `#b23a2e` (mapped to `color-signal`). `Warn`/`WarnFlag` move from `text-destructive` to `text-signal`, and a new chip variant (`WarnChip`, 2px radius, signal border + text) carries closure/seasonal warnings on road cards. `--destructive` remains for genuinely destructive UI actions; road-world warnings own signal red. Never decorative — usage limited to warning components.

**11. Mann sky plates for Explore empty/loading states.** A `.sky-mann` utility: the board's dusk gradient (`#16130f → #3a2415 → #8a4a1c → #c9611e → #e8912f` stack, vertical) — brand-surface rules apply (grain allowed, serif-italic copy, circular stamp SVG centered). Applied to: the rail's no-results state and the map loading state. These are named ceremony moments, so the warm/illustrated register is correct here per the two-ground rule; the plate is a contained inset panel (3px radius), not a full-screen takeover.

**12. Grain discipline is structural.** `.texture-grain` stays, but its one working-surface usage (the `AppShell` header) is removed — the cool shell carries no grain. Grain appears only inside `.sky-mann`/brand-surface components.

## Risks / Trade-offs

- [Paint orange on `#0a0a0b` has lower luminance contrast than the retired yellow] → It is used as accent/fill with near-black text on top (accent-as-ground, ~4.6:1 for bold caps) or as colored text at 12px+ bold tracked caps; verify the active-nav and patch text cases against WCAG 3:1 UI-component minimum in the browser pass; if the RIDDEN patch text fails at 9px, lift the text tone toward `#d97a35` while keeping borders/fills at `#c9611e`.
- [Rewriting `.dark` tokens restyles every shadcn primitive at once] → That is the point (system-level swap), but browser-verify each surface (Explore, Days, dialogs, skeletons) side-by-side with the board; tests + tsc guard behavior.
- [Hex vs oklch mixing in globals.css] → Convert the board hexes to oklch to keep the file's one color space; record the source hex in comments so the board stays traceable.
- [`Badge` outline variant still used elsewhere] → Only provenance call sites move to `PatchChip`; other Badge uses keep working under the new radius scale.
- [Rye loads ~30KB for one masthead] → Acceptable interim; `display: swap`; it exits when Chase's face arrives.

## Migration Plan

Token layer first (globals.css + layout.tsx + logo seam) — the app must build and render coherently at every commit; then components in board order (cards/patches → map furniture/masthead → day ribbons → warn chip → sky plates); browser verification against the board after each stage; `npm test` + `tsc` green throughout. Rollback is `git revert` of the change commits; no data or config migration.

## Open Questions

- None blocking. Chase supplies the real logo and display face later (seams built for both); the pinstripe flourish library and region covers are explicitly later stages.
