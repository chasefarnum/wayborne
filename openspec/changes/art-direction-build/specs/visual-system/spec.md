# Visual System

The tokenized art-direction layer: grounds, accent, radii, type and logo seams, motif components, and the discipline rules that keep the modern-chopper direction 90% chassis / 10% heritage ink. Source of truth: `research/inspiration/wayborne-art-direction-v1.md`; reference implementation: `design/direction-board-v1.html` section 06.

## ADDED Requirements

### Requirement: Cool ground family on working screens
Working screens (Explore, Days, dialogs, and all planning UI) SHALL run on the cool ground family — ground `#0a0a0b`, panel `#141416`, hairline `#232326`, text `#e7e5e4`, dim text `#8e8e93` — expressed as the active dark-theme token values. Warm stone grounds SHALL exist only as separately named brand-surface tokens and SHALL never combine with the cool family on one surface.

#### Scenario: Working screen renders on cool ground
- **WHEN** any planning screen renders in the default (dark) theme
- **THEN** its page ground, cards, and hairlines resolve to the cool family token values, with no warm-stone value on the same surface

#### Scenario: Brand surface opts into warm ground
- **WHEN** a component renders a named ceremony moment (empty state, sky plate, cover)
- **THEN** it uses the brand-surface tokens (warm ground, bone, rust) exclusively, with no cool-family value on the same surface

### Requirement: Paint orange is the single accent
The system SHALL carry exactly one accent, paint orange `#c9611e`, as the `--brand` token value; it SHALL own the shell double line, active navigation, primary CTAs, ridden provenance, and map waypoint markers. No center-line yellow value SHALL remain anywhere in the app.

#### Scenario: Yellow fully retired
- **WHEN** the app's styles and components are searched for the retired yellow accent (oklch hue-84 yellow family)
- **THEN** no usage remains; every former yellow call site renders paint orange

#### Scenario: Accent carries near-black text
- **WHEN** paint orange is used as a surface fill (CTA, active map chip)
- **THEN** the text on it is the near-black ground color, meeting WCAG 3:1 for UI components

### Requirement: Radii sharpen to 2-4px
The radius scale SHALL be literal: 2px (chips, patches), 3px (cards, buttons, inputs, map chips), 4px (dock and largest surfaces). No step SHALL exceed 4px and no pill shapes SHALL appear, excepting genuinely circular elements (waypoint dots, the compass stamp).

#### Scenario: No pills survive
- **WHEN** any chip, button, card, or dock renders
- **THEN** its corner radius is between 2px and 4px per its component class

### Requirement: Display font mounts behind a swap seam
Display-register type SHALL render via a `--font-display` token, loaded through `next/font` (interim face: Rye). The display face SHALL appear only at masthead and cover scale and SHALL never set UI labels, body text, or data. Replacing the interim face SHALL require only reassigning the token.

#### Scenario: Masthead uses the display token
- **WHEN** the Explore map masthead renders the region name
- **THEN** it uses the `font-display` utility, and no UI label anywhere resolves to the display face

#### Scenario: Face swap is config
- **WHEN** the final display face is supplied
- **THEN** swapping it in changes the font-loading declaration and token mapping only, with no component edits

### Requirement: Logo is one swappable component
The wordmark SHALL render from a single `Logo` component (interim: compass-stamp SVG + tracked Barlow caps). No other component SHALL compose wordmark markup. Replacing the interim logo SHALL touch only that component's internals.

#### Scenario: Shell consumes the logo component
- **WHEN** the app shell header renders
- **THEN** the wordmark comes from the `Logo` component

### Requirement: Provenance renders as patch chips
Provenance on road and stop cards SHALL render as patch chips: `verified` displays as RIDDEN (dashed paint-orange border, paint-orange text, faint paint-orange fill, 2px radius) and `researched` displays as RESEARCHED (plain hairline border, dim text). Underlying data values SHALL be unchanged.

#### Scenario: Ridden patch
- **WHEN** a card renders an item with provenance `verified`
- **THEN** it shows the RIDDEN patch chip with dashed paint-orange styling

#### Scenario: Researched patch
- **WHEN** a card renders an item with provenance `researched`
- **THEN** it shows the RESEARCHED patch chip with plain hairline styling

### Requirement: Rail cards carry panel logic
Explore rail cards SHALL read as tank panels: panel ground, hairline border, 3px radius, and an inset hairline (bone at low opacity) that warms toward paint orange on hover. The effect SHALL be CSS-only with no structural or behavioral change to the cards.

#### Scenario: Card at rest and on hover
- **WHEN** a rail card renders and is then hovered
- **THEN** the inset hairline is visible at rest and transitions toward paint orange on hover, with selection and click behavior unchanged

### Requirement: Day headers wear the ribbon
Per-day headers in the days view SHALL render as ribbon banners: bone band with tracked near-black caps and rust clip-path ends, per board section 04. The ribbon SHALL be the days view's only added heritage touch.

#### Scenario: Day ribbon renders
- **WHEN** the days view renders a day heading
- **THEN** the heading appears inside the ribbon banner component

### Requirement: Map furniture matches board 06
Map filter chips SHALL render at 3px radius on a translucent cool ground with backdrop blur, the active chip filled paint orange with near-black text. The floating dock SHALL render at 4px radius on translucent cool ground with a hairline border. The Explore map SHALL carry a masthead: a tracked rust-caps region eyebrow over the region name in the display face. Waypoint/stop markers SHALL fill paint orange; the bone route line and earth-tone data colors SHALL be unchanged.

#### Scenario: Active map chip
- **WHEN** a map layer filter is active
- **THEN** its chip fills paint orange with near-black text; inactive chips stay translucent with hairline borders

#### Scenario: Masthead present
- **WHEN** the Explore map renders
- **THEN** the region masthead shows the eyebrow and display-face region name over the map

### Requirement: Signal red owns warnings only
A `--signal` token (`#b23a2e`) SHALL exist and SHALL be used exclusively by warning furniture: warning text/flags and a closure warning chip (2px radius, signal border and text) on cards with closures or seasonal warnings. Signal red SHALL never appear decoratively.

#### Scenario: Closure chip
- **WHEN** a road card renders an item with a closure or seasonal warning
- **THEN** the warning renders in signal red warning furniture

### Requirement: Mann sky plates on Explore empty and loading states
The Explore rail's no-results state and the map's loading state SHALL render as Mann sky plates: the dusk gradient as a contained inset panel with grain, the circular compass stamp, and serif-italic copy. Sky plates are brand surfaces and SHALL follow brand-surface token rules.

#### Scenario: No results
- **WHEN** filters produce zero matching roads
- **THEN** the rail shows the sky-plate empty state with the stamp and a serif-italic line

#### Scenario: Map loading
- **WHEN** the map component is loading
- **THEN** the loading surface renders as a sky plate rather than a bare skeleton

### Requirement: Heritage budget and grain discipline
A working screen SHALL carry at most three heritage touches (reference allocation: double-line rule, display-face masthead, provenance patch). Grain SHALL appear only on brand surfaces; no working surface (including the shell header) SHALL carry grain.

#### Scenario: Explore at budget
- **WHEN** the Explore screen renders
- **THEN** its heritage touches are exactly: the shell double line, the map masthead, and provenance patches — and no working surface carries the grain texture
