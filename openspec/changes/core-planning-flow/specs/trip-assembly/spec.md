# trip-assembly

## ADDED Requirements

### Requirement: Trayed items assemble into daily legs
"Build days" SHALL distribute trayed items into day legs measured against the frame's daily mileage target, with per-day meters, and the rider SHALL be able to move items between days and reorder within a day.

#### Scenario: Build days from a full tray
- **WHEN** a rider with a 3 × 200 frame builds days from the tray
- **THEN** items land in day legs in ride order, and each day meter reads its mileage against 200

### Requirement: Fuel gaps surface at the leg
Fuel-gap warnings SHALL render on the affected leg using the same warning furniture as enforcement and closures, plus the compact ▲ flag on the day rail. Gap mileage SHALL be computed from curation range notes, never presented as illustrative.

#### Scenario: Pepacton-class fuel gap
- **WHEN** a day leg crosses a known fuel gap (last fuel Margaretville)
- **THEN** the leg shows the fuel warning with computed gap mileage and the day rail shows the ▲ flag

### Requirement: Connector mileage is honest about its source
Until routing is wired, connector legs between curated items SHALL display as visually distinct placeholders, and any mileage shown for them SHALL be labeled as an estimate.

#### Scenario: Two curated segments with an unrouted connector
- **WHEN** assembly shows a day containing two segments with a connector between them
- **THEN** the connector renders as a placeholder distinct from curated geometry, with its mileage marked as an estimate
