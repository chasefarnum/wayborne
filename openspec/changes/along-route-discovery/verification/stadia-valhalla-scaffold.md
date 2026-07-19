# Stadia Valhalla verification (tasks 1.1 + 1.2)

_Run 2026-07-18, from dev (localhost origin). Endpoint: `POST https://api.stadiamaps.com/route/v1`, costing `auto`, units miles._

## Task 1.1: routing works in dev

- One A-to-B call (Kingston → Phoenicia): HTTP 200, 948-point precision-6 polyline decoded to a valid GeoJSON LineString, endpoints match the input taps, 25.2 mi / 32 min (plausible for NY-28).
- **Key finding: `NEXT_PUBLIC_STADIA_API_KEY` is not in `.env.local`, and dev does not need it.** Stadia's localhost exemption covers the routing API, not just tiles (the prior session's "routing is not keyless on localhost" note was wrong). The client appends `?api_key=` only when the env var is present; production domains will need the key or Stadia property-based auth before launch.
- Decoder note: Valhalla shapes are polyline **precision 6** (1e-6), not Google's 1e-5. Decoder verified against the endpoint coordinates.

## Task 1.2: dozen-leg Catskills connector scaffold

Each leg run twice: default `auto`, and `costing_options.auto.use_highways = 0.1` (issue #3119 caveat: low values may fail to avoid highways). Pass = HTTP 200 and length within 0.9x-4x straight-line. "hwy?" = any maneuver on I-x/Thruway/NYST street names.

| # | Leg | straight mi | auto mi (min) | hwy? | use_highways=0.1 mi (min) | hwy? | verdict |
|---|---|---|---|---|---|---|---|
| 1 | Kingston → Phoenicia | 19.7 | 25.2 (32) | YES | 25.7 (34) | no | pass |
| 2 | Phoenicia → Hunter | 10.1 | 14.1 (18) | no | 14.1 (18) | no | pass |
| 3 | Hunter → Windham | 7.1 | 10.0 (17) | no | 10.0 (17) | no | pass |
| 4 | Windham → Prattsville | 9.3 | 11.6 (16) | no | 11.6 (16) | no | pass |
| 5 | Prattsville → Margaretville | 16.3 | 24.1 (32) | no | 24.1 (32) | no | pass |
| 6 | Margaretville → Roscoe | 20.0 | 35.1 (45) | no | 35.1 (45) | no | pass |
| 7 | Roscoe → Livingston Manor | 4.8 | 6.7 (8) | no | 6.7 (13) | no | pass |
| 8 | Livingston Manor → Ellenville | 25.6 | 30.5 (33) | no | 36.2 (62) | no | pass |
| 9 | Ellenville → New Paltz | 16.1 | 22.5 (27) | no | 29.0 (38) | no | pass |
| 10 | New Paltz → Woodstock | 20.3 | 26.9 (32) | YES | 24.9 (36) | no | pass |
| 11 | Woodstock → Saugerties | 8.9 | 10.2 (15) | no | 10.2 (15) | no | pass |
| 12 | Saugerties → Tannersville | 12.2 | 16.1 (22) | no | 16.1 (22) | no | pass |

**Verdict: 12/12 pass.** Quality surprises:

- **Issue #3119 did not bite here**: `use_highways=0.1` cleanly pulled legs 1 and 10 off I-87/Thruway onto surface roads at nearly identical mileage. No leg on the low setting touched a motorway.
- The low setting costs real time in the southern Catskills: leg 8 goes 33 → 62 min (avoiding the NY-17/I-86 expressway stretch), leg 7 8 → 13 min at identical distance. Where the rider asks for the fast line, default `auto` (no `use_highways` override) is the right call, matching design decision 3.
- Route lengths vs straight-line all landed between 1.2x and 1.8x: no degenerate or wildly indirect routes.
