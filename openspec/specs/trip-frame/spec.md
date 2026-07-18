# trip-frame

## Requirements

### Requirement: Time-box frame enters at minute one and is skippable
The frame (number of days × daily mileage target) SHALL be offered as the second screen of the flow, and the rider SHALL be able to skip it ("Skip and ride the map") without losing any explore capability.

#### Scenario: Frame set
- **WHEN** a rider sets 3 days at 200 miles/day
- **THEN** the frame persists (state + URL) and downstream surfaces read from it

#### Scenario: Frame skipped
- **WHEN** a rider skips the frame
- **THEN** explore works fully, and frame-dependent meters render their unframed state instead of assuming a default

### Requirement: The frame is the single ruler
Tray target, day meters, and the empty-trip proposal SHALL all derive from the frame (e.g., 600 = 3 × 200); no surface SHALL hardcode its own target.

#### Scenario: Frame edited after items are trayed
- **WHEN** a rider changes the frame from 3 to 4 days
- **THEN** the tray target and day meters update from the new frame without losing trayed items

### Requirement: Frame-to-proposal seam is decided before build
The seam between setting the frame and receiving a proposed starting loop SHALL follow the decision recorded in design.md Open Question 1 (recommendation: explore-first stays deliberate; the skeleton proposal surfaces only via the empty-trip state).

#### Scenario: Frame completed under explore-first
- **WHEN** the rider completes the frame and the explore-first decision stands
- **THEN** the flow lands in explore, and the skeleton proposal appears only from the empty-trip state
