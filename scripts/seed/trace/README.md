# Segment tracing prototype — region 01

Proves the query+match+stitch pattern on 3 of the 47 curated roads before
scaling. Source: Overture Maps transportation theme, `type=segment`, release
2026-06-17.0 (same store-friendly release the stops geocoding used). Nothing
here touches the database or the seed files; output is
`prototype-traces.geojson` next to this file, produced by
`node scripts/seed/trace/prototype-trace.mjs`.

## Local parquet (one S3 pass, then everything local)

Downloaded 2026-07-18 with DuckDB (httpfs + spatial), anonymous S3:

```sql
INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
CREATE OR REPLACE SECRET s3anon (TYPE S3, PROVIDER config, REGION 'us-west-2');
COPY (
  SELECT id, names, subtype, class, subclass, routes, road_surface, road_flags,
         connectors, geometry, bbox
  FROM read_parquet('s3://overturemaps-us-west-2/release/2026-06-17.0/theme=transportation/type=segment/*.parquet')
  WHERE subtype = 'road'
    AND class IN ('motorway','trunk','primary','secondary','tertiary','unclassified','residential')
    AND bbox.xmin >= -75.3 AND bbox.xmax <= -73.3
    AND bbox.ymin >= 41.0  AND bbox.ymax <= 42.6
) TO '<scratchpad>/overture-transport-region01.parquet' (FORMAT parquet, COMPRESSION zstd);
```

Result: **204,768 rows, 43 MB** (148,795 residential / 22,899 tertiary /
11,255 secondary / 9,873 primary / 5,063 unclassified / 4,195 trunk /
2,688 motorway). The parquet lives in the session scratchpad; the script takes
`OVERTURE_PARQUET` env to point elsewhere. Re-download with the query above if
it is gone.

## Schema fields that matter

- `names.primary` — street name; changes across municipal lines on county roads
- `routes[]` — list of `{name, network, ref, symbol, wikidata, between}`.
  Refs are bare (`ref='214'`, not "NY 214"); networks: `US:NY` state,
  `US:US` federal, `US:I` interstate, `US:NY:<County>` county (Ulster,
  Greene, Sullivan, Dutchess, ...). `between` marks partial-range route
  membership on a segment (seen on Sundown Rd where CR-153 hands off to
  CR-46 mid-segment); zero occurrences on the three roads traced here.
- `class` — road class; the curated roads land in secondary/tertiary/
  unclassified/residential (Perkins Memorial Drive is `unclassified`)
- `geometry` — LineString, WGS84 lon/lat; segments split at `connectors`,
  so junction endpoints are coordinate-identical (exact stitching, no snapping)
- `subclass` — NULL on normal roadway; link/ramp pieces are marked

## Method (per road)

1. Candidate segments by route ref (state routes) or `names.primary` +
   corridor bbox (county roads without a mapped ref).
2. Node graph on exact shared endpoints.
3. Two junction anchors resolved from the crossing roads named in the seed's
   `route_desc` (anchor = candidate node coinciding with an endpoint of the
   crossing road, nearest to a rough town hint).
4. Dijkstra anchor-to-anchor: stitches, orients, clips to the described
   stretch, and sheds spurs in one move.
5. Haversine length vs seed `length_mi`; flag if off by more than 20%.

All three anchors resolved as **exact shared endpoints** (no fuzzy snapping
was needed anywhere).

## Per-road results

### r-002 NY-214: Stony Clove Notch — clean
- Match: route ref `214`, network `US:NY`. 32 candidates, all 32 used.
- Single LineString, NY-28 near Phoenicia to NY-23A junction ~2 mi east of
  Hunter village (that is 214's real north terminus; seed says "in Hunter",
  close enough).
- Length 12.33 mi vs seed 12.5 (-1.4%). No judgment calls. High confidence.

### r-001 NY-23A: Kaaterskill Clove — traced clean, seed length is wrong
- Match: route ref `23A`. 118 candidates (the full route, Prattsville to
  Catskill), 78 used after clipping at the NY-32A junction in Palenville.
- Single LineString, Palenville (-74.0201, 42.1748) to the NY-23 junction at
  Prattsville (-74.4175, 42.3048).
- Length 26.17 mi vs seed 34.5 (**-24.1%, flagged**). ADJUDICATE: the seed's
  34.5 is NY-23A's FULL route length (Overture's total for ref 23A in-region
  is 34.51 mi — exact match), while `route_desc` limits the stretch to
  Palenville-Prattsville. The trace is right; the seed `length_mi` carries
  the whole-route figure. Recommend correcting `length_mi` to ~26 when this
  geometry is seeded. High confidence in the geometry itself.
- Note: "Main Street" segments through Tannersville/Hunter carry the 23A ref
  and are correctly included.

### r-003 Peekamoose Road (Ulster CR-42) — the hard case, solved by names
- No `US:NY:Ulster` ref 42 exists in this Overture release, so ref matching
  is impossible. The signed corridor is FOUR named roads:
  Watson Hollow Road (NY-28A at West Shokan up the notch) + Peekamoose Road
  (over the top, past the Blue Hole) + County Line-Sundown Road (the short
  county-line stretch through Sundown hamlet — this was the missing link that
  broke the first stitch attempt) + Sundown Road (Sullivan CR-153 / Ulster
  CR-46 down to NY-55A).
- Match: those 4 names, classes tertiary/residential/unclassified, corridor
  bbox lon -74.56..-74.24 lat 41.84..41.99 (there are OTHER Sundown/Gulf
  Roads near Grahamsville and in Greene County; the bbox + Dijkstra shed
  them). 32 candidates, 20 used.
- Single LineString, NY-28A (-74.2769, 41.9690) to NY-55A (-74.5092, 41.8613).
- Length 16.43 mi vs seed 18 (-8.7%, ok — seed is a round sweep number).
- ADJUDICATE (mild): seed titles the whole thing "Ulster CR-42" but the last
  ~2.5 mi (Sundown Road) is signed Sullivan CR-153 / Ulster CR-46, and the
  road name at the West Shokan end is Watson Hollow Road. Blurb/naming may
  want a touch when published. Geometry confidence high.

## What will make scaling to 47 painful

1. **County roads mostly have no route ref.** CR-42 is absent outright.
   Name-based matching needs a per-road name list plus a corridor bbox, and
   names change at municipal boundaries (one CR = 4 names above). Budget
   adjudication time per county road; state routes are nearly free.
2. **Same names recur across the region** (3 distinct Sundown Roads, several
   Gulf Roads). Never match by name without a corridor bbox.
3. **Seed `length_mi` is not always the described stretch** (r-001: full-route
   figure vs clove-limited `route_desc`). Expect more >20% flags that are
   seed-data errors, not trace errors; each needs the r-001 style adjudication
   rather than auto-trust in either direction.
4. **Anchors need per-road config.** `route_desc` usually names crossing
   routes ("NY-28 near Phoenicia") — those work as programmatic anchors. Some
   only name hamlets ("Woodstock", "Turnwood"); those need hint coordinates
   or a places lookup instead of a crossing-road ref.
5. **Concurrencies**: NY-22/NY-343 run concurrent (r-050's own warning);
   segments carry both refs, so two seed roads will share Overture segments.
   Fine for geometry, but dedupe expectations when counting.
6. **Partial-range `routes[].between`** exists in the data (CR-153/CR-46
   handoff mid-segment). Zero impact on these three; a scaled tracer should
   detect non-null `between` on candidates and split by linear reference if
   a route-ref match is partial.
7. **Name-length mismatches signal name handoffs**: e.g. "Willowemoc Road"
   named segments total only ~4.6 mi vs seed 12 — the corridor continues
   under other names, same pattern as Peekamoose. "Old Route 17" appears in
   4 classes over 19+ discontinuous miles; r-021 will need a tight bbox and
   possibly a MultiLineString verdict.
8. Spot-checked presence: Perkins Memorial Drive (unclassified), Seven Lakes
   Drive, Platte Clove Road, Barkaboom Road, Arden Valley Road etc. all exist
   in the local parquet — the class filter holds. If a future road comes up
   empty, widen the class list (`service`, `track`) and re-download.

## Files

- `prototype-trace.mjs` — rerunnable tracer (duckdb CLI + plain JS, no deps)
- `prototype-traces.geojson` — 3 traced LineStrings with per-feature
  provenance (match method, segment ids, counts, length check, anchors)
