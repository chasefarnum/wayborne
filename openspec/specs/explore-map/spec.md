# explore-map

## Requirements

### Requirement: Curated segments render as character-tagged overlays
The map SHALL render published road segments (`review_status = 'keep'` in an accessible region) as colored line overlays sourced from stored geometry, styled by character tags, never by a "best" ranking.

#### Scenario: Region content loads on the map
- **WHEN** a rider opens explore for a published free region
- **THEN** every kept segment with traced geometry renders as an overlay, and segments without geometry are omitted from the map but remain listable

### Requirement: Stops are filterable layers
Stops SHALL render as map layers filterable by category, with filters combinable and reflected in the URL.

#### Scenario: Category filter applied
- **WHEN** a rider filters to `dec_campground` and `diner`
- **THEN** only open, kept stops in those categories remain visible, and the URL query reflects the active filters

#### Scenario: Zero results with computable explanation
- **WHEN** an applied filter combination yields no stops and the system can explain the empty set
- **THEN** the empty state shows the explanation (e.g., "dealers cluster around Kingston")

#### Scenario: Zero results without computable explanation
- **WHEN** an applied filter combination yields no results and no explanation is computable
- **THEN** the empty state shows the plain fallback copy ("no road carries all three" pattern), never a blank panel

### Requirement: Editorial cards carry provenance honestly
Selecting a segment or stop SHALL open an editorial card with the blurb, character tags or category, warnings, and a provenance badge. The badge SHALL render `researched` as its own single state; `verified` SHALL never be faked or simulated.

#### Scenario: Researched stop selected
- **WHEN** a rider selects a region-01 stop
- **THEN** the card shows the editorial blurb and a `researched` badge, and verification progress renders as the zero-state bar with season framing

### Requirement: Route mode changes what the map says, not what it is
When a route is active, the map SHALL render the rider's line as a single LineString with marked endpoints, a visible ~5-mile corridor treatment containing the line, in-corridor pins at full strength, and out-of-corridor content dimmed. Clearing the route SHALL restore the catalog map exactly. Base layers, pin categories, and card behavior SHALL be unchanged by route mode.

#### Scenario: Route active on the map
- **WHEN** a rider's line is set
- **THEN** the line, endpoints, and corridor render, in-corridor pins show full strength, and everything outside the corridor dims

#### Scenario: Route cleared from the map
- **WHEN** the rider clears the route
- **THEN** the map returns to the catalog presentation with all published content at full strength

### Requirement: Route-mode motion earns its complexity
The routed line SHALL draw in over roughly 400ms after routing resolves, the corridor SHALL appear after the line completes, and filter changes SHALL update list and pins in one beat. Under reduced motion, all of these SHALL be instant swaps with no loss of information.

#### Scenario: Reduced motion preference set
- **WHEN** a rider with prefers-reduced-motion sets a route
- **THEN** line, corridor, and results appear instantly with no animation

### Requirement: Focus-visible treatment on every interactive element
Every interactive element in the planning flow (explore, frame, tray, assembly) SHALL have a visible focus state meeting the taste doc's focus-visible spec, applied in the component pass, not only on inputs.

#### Scenario: Keyboard traversal of explore
- **WHEN** a rider tabs through filters, cards, and tray controls
- **THEN** each focused element shows a visible, high-contrast focus indicator
