# along-route-explore

## Requirements

### Requirement: Corridor-only results with one whole-region escape
When a route is active, explore SHALL show only curated content within the 5-mile corridor (8046.72 m) of the rider's line, with exactly one escape hatch to the whole-region catalog. The escape SHALL retain the stored route and offer a way back to it. There SHALL be no third mode.

#### Scenario: Route active
- **WHEN** a rider's line is set
- **THEN** the list and map show only in-corridor published content, with the escape link visible

#### Scenario: Whole-region escape taken
- **WHEN** the rider chooses "Show the whole region"
- **THEN** the catalog surface renders with a notice that the route is saved and a "Back to your route" control

### Requirement: The list reads as the ride, in order
The along-route list SHALL order results by position along the line (milepost order), POI-first, each row carrying its milepost, provenance badge, off-line distance, and add-to-trip. The header count SHALL equal the rows shown. A loop route passing a stop twice SHALL list it once, at first approach. 100+ results SHALL scroll naturally with no pagination furniture.

#### Scenario: Kingston to Roscoe corridor
- **WHEN** the corridor query returns stops along the line
- **THEN** rows render in milepost order with "mi N" labels derived from position along the route, and the header count matches the rendered rows

#### Scenario: Loop passes a stop twice
- **WHEN** a loop route brings a stop within the corridor at two points
- **THEN** the stop lists once, at its first approach milepost

### Requirement: Off-line distance is the only distance
Each result SHALL show its straight-line off-route distance ("~N mi off your line"). Detour times or added-mileage estimates SHALL NOT be shown until routing actually computes them (not in this change).

#### Scenario: Stop 2.1 miles off the line
- **WHEN** the corridor query returns a stop with off_line_m of ~3380
- **THEN** the row reads "~2.1 mi off your line" with no time estimate anywhere

### Requirement: Quiet stretches and coverage exits are told inline
Gaps in the corridor SHALL be narrated inline in the list at their mileposts, with two distinct messages: a quiet stretch inside the curated region (nothing within 5 mi of this part of the line, where it picks back up), and the line leaving the curated coverage (the vetted layer ends here). Nothing SHALL render blank and no message SHALL imply content that does not exist.

#### Scenario: Quiet stretch mid-route
- **WHEN** consecutive results are separated by a large milepost gap inside the curated region
- **THEN** an inline note names the quiet stretch and where the corridor picks back up

#### Scenario: Line runs past the curated region
- **WHEN** the line continues beyond the region's published coverage
- **THEN** an inline note at the exit milepost says the curation ends there, and no results are fabricated beyond it

### Requirement: Intent filters never contradict the results
Route mode SHALL present intent-level filter chips (e.g., Camping tonight, Food & towns, Overlooks, Twisty roads) with none active by default. An active chip SHALL filter the list and the map pins together; the visible chip state SHALL always match the visible results.

#### Scenario: Camping chip activated
- **WHEN** the rider activates "Camping tonight"
- **THEN** only camping results remain in both list and map, in milepost order, and deactivating restores the full corridor

### Requirement: Corridor results load honestly
Between the line landing and results arriving, a loading state SHALL render in the list region. A blank or stale list SHALL never show while the corridor query is in flight.

#### Scenario: Query in flight
- **WHEN** the line lands and the corridor RPC has not returned
- **THEN** the list region shows the corridor-loading state until results or an inline error render

### Requirement: Along-route feeds the same trip
Adding from the along-route list SHALL feed the existing trip exactly as the catalog does; tray, frame, and Build days behavior SHALL be unchanged by route mode.

#### Scenario: Add from corridor row
- **WHEN** the rider adds a corridor result to the trip
- **THEN** it appears in the tray and behaves in frame and days exactly as an add from the catalog
