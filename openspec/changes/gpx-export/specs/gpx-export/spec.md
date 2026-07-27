## ADDED Requirements

### Requirement: Each day leg exports as a GPX 1.1 route file
The days surface SHALL offer a per-day export action that generates a GPX 1.1 file client-side containing a single `<rte>`, with the GPX 1.1 namespace, `creator="Wayborne"`, a route name identifying the region and the day ("Wayborne · <region> · Day n of N"), XML-escaped names, and coordinates emitted at 6 decimal places. The file SHALL download as `wayborne-<region-slug>-day-<n>.gpx` with no server round-trip.

#### Scenario: Exporting a built day
- **WHEN** a rider with built days triggers Export GPX on day 2 of a 3-day Catskills / Hudson Valley trip
- **THEN** the browser downloads `wayborne-catskills-hudson-valley-day-2.gpx`, a valid GPX 1.1 document whose single route is named "Wayborne · Catskills / Hudson Valley · Day 2 of 3"

#### Scenario: Names carrying XML-hostile characters
- **WHEN** an exported item's name contains `&`, `<`, or quotes (e.g., "Hickory BBQ & Smokehouse")
- **THEN** the emitted file escapes them and remains well-formed XML

### Requirement: Route points derive from the day's items in ride order
Route points SHALL be generated from the day leg's items in ride order: each located stop contributes one `rtept` named after the stop; each traced segment contributes an entry point, interior shaping point(s), and an exit point, each named after the road with start/end markers. Points SHALL carry meaning a rider can act on in their nav app; the builder SHALL emit no unnamed or filler points.

#### Scenario: Mixed day of stops and roads
- **WHEN** a day holds, in ride order, a diner stop, a curated segment, and a campground stop
- **THEN** the route reads: the diner point, the segment's entry point, its shaping point(s), its exit point, then the campground point, in that order

### Requirement: Segments are oriented by nearest-endpoint chaining
Each segment SHALL enter at whichever endpoint of its traced line is nearer the previous emitted point (the moving anchor), so roads are ridden continuously in the day's direction of travel. When the first item of the day is a segment, its orientation SHALL be chosen against the next located item; a day offering no other located item SHALL keep the traced direction.

#### Scenario: Segment follows a stop
- **WHEN** a segment's traced line has endpoint A 2 miles from the previous stop and endpoint B 15 miles from it
- **THEN** the segment enters at A and exits at B

#### Scenario: Day opens with a segment
- **WHEN** the day's first item is a segment and the second item is a located stop nearer endpoint B
- **THEN** the segment is oriented to exit at B, toward the stop

### Requirement: Point budget respects the Detecht importer guidance
Shaping points SHALL be included only while the file's total point count stays within the benchmark budget of 30, collapsing from the shortest segments first, before any stop or entry/exit point is affected. Stop and entry/exit points SHALL never be dropped by the builder: a day whose essential points alone exceed the budget still exports in full.

#### Scenario: Day exceeding the budget with shaping included
- **WHEN** a day's stops and segment entry/exit points total 24 and per-segment shaping would push the file past 30
- **THEN** shaping points are omitted from the shortest segments until the total fits, and all 24 essential points remain

### Requirement: Items the file cannot carry are excluded and said out loud
Items without usable geometry (untraced segments, ungeocoded stops) SHALL be excluded from the file and reported to the rider alongside the export action as per-item notes naming the item and the reason. The builder SHALL never emit a guessed coordinate. A day yielding fewer than two route points SHALL have no exportable line: the export action disables with the reason inline.

#### Scenario: Day containing an ungeocoded stop
- **WHEN** a day includes a stop that has no pin (no trustworthy coordinate on record)
- **THEN** the exported file omits it and the days view shows a note naming the stop and that it is not in the file

#### Scenario: Day with nothing exportable
- **WHEN** a day's only items lack geometry
- **THEN** the export action is disabled with the reason shown inline, and no file is offered
