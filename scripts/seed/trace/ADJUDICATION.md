# Region-01 trace adjudication — 2026-07-18

48 of 50 seeded roads traced (807 mi) into `region-01-traces.geojson`.
Source: Overture transportation 2026-06-17.0, local parquet (west edge
-75.5). Nothing seeded to the database yet; this file is the human review
record the seeding step should read alongside the GeoJSON.

## Not traced (2) — absent beats wrong

- **r-035 Dennytown Road** — the named chain (Dennytown 1.25 mi + Oscawana
  Lake 3.15 mi) does not connect cleanly in Overture; every path NY-301 to
  Peekskill Hollow leaned on 26+ filler segments (Canopus Hollow Road, a
  parallel road). Needs a per-road look at what the NER 5-mile pick actually
  is before geometry ships.
- **r-048 Dutchess CR-24** — Overture's ref-24 pieces (Chestnut Ridge +
  Halls Corners, ~6 mi) do not compose the seed's 15-mile Dover Plains to
  Lagrangeville notion; the trace shortcut down NY-343. The seed's own
  composition needs deciding first.

## Length flags that are seed-figure issues (trace right, seed rough or wrong)

Same pattern the prototype proved on r-001 (seed carries a full-route or
rounded figure; `route_desc` names a narrower or wider stretch). Correct
`length_mi` at seeding time, do not stretch the geometry:

- r-001 NY-23A 26.17 vs 34.5 — known: seed uses the full-route figure.
- r-005 NY-42 North 11.41 vs 9 — Shandaken..Lexington genuinely rides ~11.4.
- r-017 NY-55 28.32 vs 15 — route_desc says Liberty..Napanoch, which is
  ~28 mi; the 15 looks like a Neversink..Napanoch subsection figure.
- r-020 Willowemoc 7.39 vs 12 — road distance Debruce..Willowemoc hamlet is
  ~7.4; the 12 likely bundles the continuation beyond the hamlet.
- r-023 Barkaboom 5.07 vs 7 — named road is ~4.7 mi (cyclist-sourced seed
  figure was a guess; README trap 3).
- r-026 NY-42 South 20.58 vs 14 — Sparrowbush..Monticello straight-line is
  already 17.5 mi; the 14 undercounts the described run.
- r-029 Storm King 3.76 vs 3 and r-028 Hawk's Nest 2.64 vs 2.1 — editorial
  cliff-section bounds; traces include short natural approaches.
- r-031 Perkins 3.16 vs 4 — the full drive Seven Lakes junction to summit
  loop is ~3.2.
- r-032 Goat Trail 4.29 vs 3 — includes the approach down to the US-9
  side; clip editorially if wanted.
- r-036 Kanawauke 12.96 vs 10 — full Stony Point..NY-17 run.
- r-037 Arden Valley 5.07 vs 4 — named road is ~5.1.
- r-038 Greenwood Lake loop 11.75 vs 15 — honest mileage of the described
  17A + 210 chain.
- r-041 NY-52 climb 12.19 vs 9 — traced to Pine Bush; clip at Walker Valley
  would be ~9 (route_desc says "Walker Valley/Pine Bush", ambiguous).
- r-044 NY-9G 19.66 vs 25 — Rhinebeck..Rip Van Winkle Bridge is ~20.
- r-045 NY-82 39.23 vs 30 — full Hopewell..Pine Plains run on 82.
- r-050 NY-343 3.49 vs 5 — Amenia..CT line is ~3.5.
- r-008 Ohayo Mountain 4.67 vs 6 — corridor plus its street connectors at
  both ends; check the path visually before publishing.
- r-024 Mountaindale 6.63 vs 8 (unflagged but adjacent) — terminal-anchored
  named corridor.

## Paths that used heavy filler — eyeball before seeding

Filler segments (4x-penalized, any road class) bridge real naming gaps, but
these four leaned on them enough that a visual pass is owed:

- r-042 NY-213/Lucas Turnpike (26 filler segments)
- r-046 Dutchess CR-83 (14)
- r-006 Platte Clove (12: Tannersville village streets at the 23A end)
- r-030 Seven Lakes Drive (11: the traffic circles along the drive — these
  are genuinely part of the corridor)

## Anchor methods worth knowing at review

Grade-separated junctions (NY-17 crossings at Roscoe, Southfields, Hancock)
resolve via the 250 m tier, not exact shared endpoints. Terminal and
diameter anchors report how far off the hint they landed; nothing landed
anywhere implausible in the final run.
