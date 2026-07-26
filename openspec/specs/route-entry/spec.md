# route-entry

## Requirements

### Requirement: Map-tap A-to-B is a two-tap entry
The route entry surface SHALL let a rider set a route by tapping a start point and an end point on the map, with Stadia Valhalla computing the line client-side. There SHALL be no geocoder text fields and no freehand drawing in v1. After the first tap, the start marker and a prompt for the end SHALL render; after the second tap, a routing-in-flight state SHALL render until the line lands. The Stadia API key SHALL be read from environment configuration and never appear in source.

#### Scenario: First tap placed
- **WHEN** a rider taps the map with no route set
- **THEN** the start marker renders with the prompt to tap an end, and no line is drawn

#### Scenario: Line lands after second tap
- **WHEN** the rider taps an end point and the routing call succeeds
- **THEN** the routed line renders as one LineString and explore enters along-route mode

### Requirement: Routing failure keeps the rider's taps
When the routing call fails, the system SHALL keep both tapped points, say plainly that the line could not be drawn, and offer retry and GPX import. A fake or straight-line route SHALL never be rendered in place of a failed routing result.

#### Scenario: Routing service does not answer
- **WHEN** the Valhalla call errors or times out
- **THEN** the error state shows with start and end still set, offering "Try again" and "Import GPX instead", and no line renders

### Requirement: GPX import is parsed client-side
The rider SHALL be able to import a GPX file (track or route) as their line. Parsing SHALL happen client-side with no new dependencies; tracks beyond roughly 500 points SHALL be simplified client-side before storage and querying. An unreadable file SHALL produce a plain-words error offering another file or map-tap entry; no partial or guessed line SHALL render.

#### Scenario: Garmin track imports
- **WHEN** a rider imports a 9,000-point GPX track
- **THEN** the track is simplified client-side, the line renders, and explore enters along-route mode

#### Scenario: File is not a route
- **WHEN** an imported file contains no readable GPX track or route
- **THEN** the error state explains what is looked for and offers "Choose another file" and map-tap entry

### Requirement: The route persists locally and only locally
The active route SHALL persist in versioned localStorage following the trip-storage discipline, restoring line and corridor on reload. The URL SHALL carry only a route-mode flag; the line itself SHALL NOT be written to the URL and SHALL NOT be stored server-side in v1. Edit and clear controls SHALL be available whenever a route is active.

#### Scenario: Reload with an active route
- **WHEN** a rider reloads the page with a stored route
- **THEN** the line, corridor, and along-route list restore without re-entry

#### Scenario: Route cleared
- **WHEN** the rider clears the route
- **THEN** explore returns to the catalog surface, the stored route is removed, and the trip (tray, frame, days) is untouched

### Requirement: Entry is always cancellable
The route entry surface SHALL offer a way back to the catalog explore that changes nothing.

#### Scenario: Rider backs out
- **WHEN** a rider opens route entry and chooses "Back to explore"
- **THEN** the catalog surface renders exactly as before, with no route stored
