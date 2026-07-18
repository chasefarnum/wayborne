# trip-tray

## Requirements

### Requirement: Add-to-trip has a visible destination
The tray dock under explore SHALL show item count, running miles against the framed target, a last-added confirmation, and ride-order chips, and SHALL offer "Build days" as the bridge into assembly.

#### Scenario: Segment added from an editorial card
- **WHEN** a rider adds a segment to the trip
- **THEN** the tray count and running miles update, the last-added confirmation names the segment, and a ride-order chip appears in sequence

### Requirement: Tray ruler scope follows the build decision
The tray meter SHALL follow the scope decision recorded in design.md Open Question 2 (recommendation: whole-trip scope before days exist, day-scope once days exist).

#### Scenario: Days created under the recommended decision
- **WHEN** the rider builds days and the day-scope decision stands
- **THEN** the tray meter flips from trip-scope (of 600) to the active day's scope (of 200)

### Requirement: Long trays degrade deliberately
At high item counts (30+), the tray SHALL apply its specified overflow behavior (horizontal scroll, collapse, or count-only — pick one at implementation and spec it) instead of breaking layout.

#### Scenario: 30+ items trayed
- **WHEN** the tray holds 30 or more items
- **THEN** the chosen overflow behavior engages, all items remain reachable, and the count and running miles stay visible

### Requirement: Trip state survives reload
Tray contents and ride order SHALL persist across page reloads on the same device (versioned localStorage), without requiring an account.

#### Scenario: Reload mid-planning
- **WHEN** a rider reloads the page with items in the tray
- **THEN** the tray restores items, order, and the frame
