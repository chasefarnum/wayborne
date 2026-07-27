## ADDED Requirements

### Requirement: Each day leg exports as a GPX 1.1 dual-carrier file
The days surface SHALL offer a per-day export action that generates a GPX 1.1 file client-side carrying the day's points twice: a single named `<rte>` and a mirror `<trk>` with identical coordinates in identical order (Detecht's web importer parses only track points and errors on route-only files; the app and Garmin honor the route). The file SHALL use the GPX 1.1 namespace, `creator="Wayborne"`, a route and track name identifying the region and the day ("Wayborne · <region> · Day n of N"), XML-escaped names, and coordinates at 6 decimal places, and SHALL download as `wayborne-<region-slug>-day-<n>.gpx` with no server round-trip.

#### Scenario: Exporting a built day
- **WHEN** a rider with built days triggers Export GPX on day 2 of a 3-day Catskills / Hudson Valley trip
- **THEN** the browser downloads `wayborne-catskills-hudson-valley-day-2.gpx`, a valid GPX 1.1 document whose named route and mirror track both carry the day's points

#### Scenario: Importing into Detecht's web trip planner
- **WHEN** the exported file is imported by a consumer that reads only track points (Detecht's web trip planner)
- **THEN** the mirror track yields the same points the route carries, in ride order

#### Scenario: Names carrying XML-hostile characters
- **WHEN** an exported item's name contains `&`, `<`, or quotes (e.g., "Hickory BBQ & Smokehouse")
- **THEN** the emitted file escapes them and remains well-formed XML

### Requirement: Waypoints are locations — one per item, in ride order
Route points SHALL be generated from the day leg's items in ride order, one point per item: each located stop contributes one point named after the stop; each traced segment contributes one point named after the road, placed on the traced vertex nearest the road's arc-length midpoint. The builder SHALL emit no unnamed, duplicate, or shaping points; the nav app's router owns the line between locations.

#### Scenario: Mixed day of stops and roads
- **WHEN** a day holds, in ride order, a diner stop, two curated segments, and a campground stop
- **THEN** the route reads exactly four named points: the diner, each road's midpoint point, and the campground, in that order

#### Scenario: Road waypoint sits on the road
- **WHEN** a segment's traced vertices are unevenly spaced
- **THEN** its exported point is an actual traced vertex, the one nearest half the road's length, never an interpolated coordinate

### Requirement: Items the file cannot carry are excluded and said out loud
Items without usable geometry (untraced segments, ungeocoded stops) SHALL be excluded from the file and reported to the rider alongside the export action as per-item notes naming the item and the reason. The builder SHALL never emit a guessed coordinate. A day yielding fewer than two route points SHALL have no exportable line: the export action disables with the reason inline.

#### Scenario: Day containing an ungeocoded stop
- **WHEN** a day includes a stop that has no pin (no trustworthy coordinate on record)
- **THEN** the exported file omits it and the days view shows a note naming the stop and that it is not in the file

#### Scenario: Day with nothing exportable
- **WHEN** a day's only items lack geometry
- **THEN** the export action is disabled with the reason shown inline, and no file is offered
