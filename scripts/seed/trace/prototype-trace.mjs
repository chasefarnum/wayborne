// Prototype segment tracing for region 01 — proves the query+match+stitch
// pattern on 3 roads before scaling to all 47. Source: Overture Maps
// transportation theme, release 2026-06-17.0 (store-friendly license), reduced
// to a local bbox parquet once (see README.md for the download query). This
// script never touches S3, never touches the database, and never modifies the
// seed files: it reads the local parquet through the duckdb CLI and writes
// prototype-traces.geojson next to itself.
//
// Pattern per road:
//   1. SELECT candidate segments (by route ref for state routes, by
//      names.primary + corridor bbox for county roads with no mapped ref).
//   2. Build a node graph on exact shared endpoints (Overture splits segments
//      at connectors, so junction endpoints are coordinate-identical).
//   3. Resolve two junction ANCHORS from the crossing road named in the seed's
//      route_desc (e.g. "NY-28 near Phoenicia"): the anchor node is a candidate
//      node that coincides with an endpoint of the crossing road, nearest to a
//      rough town-coordinate hint.
//   4. Dijkstra shortest path anchor-to-anchor. This stitches, orients, clips
//      to the described stretch, and sheds spurs/other-name noise in one move.
//   5. Haversine length vs the seed's length_mi; flag if off by more than 20%.
//
// Usage:  node scripts/seed/trace/prototype-trace.mjs
// Env:    OVERTURE_PARQUET to point at a different local parquet.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PARQUET =
  process.env.OVERTURE_PARQUET ??
  "/private/tmp/claude-501/-Users-chasefarnum-claude-projects-personal-wayborne/5f3053e8-f111-40f4-bce9-f120ea94ee30/scratchpad/overture-transport-region01.parquet";

// ---------------------------------------------------------------------------
// Road configs. candidateSql yields {id, name, class, gj}; each anchor's sql
// yields {sp, ep} start/end points of the crossing road's segments.

const stateRoute = (ref) =>
  `len(list_filter(routes, r -> r.network = 'US:NY' AND r."ref" = '${ref}')) > 0`;

const ROADS = [
  {
    sweep_id: "r-002",
    name: "NY-214: Stony Clove Notch",
    seed_length_mi: 12.5,
    match_method: "route ref 214 (network US:NY)",
    candidateWhere: stateRoute("214"),
    anchors: [
      { label: "NY-28 near Phoenicia", where: stateRoute("28"), hint: [-74.313, 42.081] },
      { label: "NY-23A in Hunter", where: stateRoute("23A"), hint: [-74.21, 42.2] },
    ],
  },
  {
    sweep_id: "r-001",
    name: "NY-23A: Kaaterskill Clove",
    seed_length_mi: 34.5,
    match_method:
      "route ref 23A (network US:NY), clipped Palenville..Prattsville via anchors",
    candidateWhere: stateRoute("23A"),
    anchors: [
      // Eastern clip: 23A continues past Palenville to Catskill; the seeded
      // stretch starts at the NY-32A junction in Palenville.
      { label: "NY-32A at Palenville", where: stateRoute("32A"), hint: [-74.02, 42.175] },
      // Western end: 23A's terminus at NY-23 in Prattsville.
      { label: "NY-23 at Prattsville", where: stateRoute("23"), hint: [-74.43, 42.32] },
    ],
  },
  {
    sweep_id: "r-003",
    name: "Peekamoose Road (Ulster CR-42)",
    seed_length_mi: 18,
    match_method:
      "names.primary IN (Watson Hollow Road, Peekamoose Road, County Line-Sundown Road, Sundown Road) within corridor bbox; no CR-42 ref exists in Overture here",
    // Ulster CR-42 carries no route ref in this Overture release. The signed
    // corridor is four named roads: Watson Hollow Rd (NY-28A at West Shokan up
    // the notch), Peekamoose Rd (over the top past the Blue Hole), County
    // Line-Sundown Rd (the short county-line stretch through Sundown hamlet),
    // and Sundown Rd (Sullivan CR-153 / Ulster CR-46 down to NY-55A).
    // Residential/unclassified pieces are allowed because hamlet stretches
    // drop out of tertiary; the bbox plus Dijkstra shed the same-named roads
    // elsewhere in the region (other Sundown/Gulf Roads near Grahamsville and
    // in Greene County).
    candidateWhere: `names."primary" IN ('Watson Hollow Road', 'Peekamoose Road', 'County Line-Sundown Road', 'Sundown Road')
      AND class IN ('tertiary', 'residential', 'unclassified')
      AND bbox.xmin >= -74.56 AND bbox.xmax <= -74.24
      AND bbox.ymin >= 41.84 AND bbox.ymax <= 41.99`,
    anchors: [
      { label: "NY-28A at West Shokan", where: stateRoute("28A"), hint: [-74.28, 41.95] },
      { label: "NY-55A near Grahamsville", where: stateRoute("55A"), hint: [-74.51, 41.86] },
    ],
  },
];

// ---------------------------------------------------------------------------
// DuckDB access (shells out to the CLI; same tool the stops geocoding used).

function duckdb(sql) {
  const out = execFileSync("duckdb", ["-json", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  // duckdb prints spatial-extension warnings (with ANSI color codes) to
  // stdout; strip them and parse from the line the JSON array starts on.
  const clean = out.replace(/\x1b\[[0-9;]*m/g, "");
  const start = clean.search(/^\[/m);
  return start === -1 ? [] : JSON.parse(clean.slice(start));
}

// duckdb -json may hand GeoJSON columns back as parsed objects or strings.
const asGeoJson = (v) => (typeof v === "string" ? JSON.parse(v) : v);

function fetchCandidates(where) {
  return duckdb(`
    LOAD spatial; SET geometry_always_xy = true;
    SELECT id, names."primary" AS name, class, ST_AsGeoJSON(geometry) AS gj
    FROM '${PARQUET}'
    WHERE ${where};
  `).map((r) => ({
    id: r.id,
    name: r.name,
    class: r.class,
    coords: asGeoJson(r.gj).coordinates, // all rows here are LineStrings
  }));
}

function fetchAnchorEndpoints(where) {
  return duckdb(`
    LOAD spatial; SET geometry_always_xy = true;
    SELECT ST_AsGeoJSON(ST_StartPoint(geometry)) AS sp,
           ST_AsGeoJSON(ST_EndPoint(geometry)) AS ep
    FROM '${PARQUET}'
    WHERE ${where};
  `).flatMap((r) => [asGeoJson(r.sp).coordinates, asGeoJson(r.ep).coordinates]);
}

// ---------------------------------------------------------------------------
// Geometry helpers.

const R_MI = 3958.7613; // earth radius, miles
function haversineMi([lon1, lat1], [lon2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(a));
}
const lineLengthMi = (coords) =>
  coords.reduce((mi, c, i) => (i ? mi + haversineMi(coords[i - 1], c) : 0), 0);

// Overture endpoints at shared connectors are coordinate-identical; 6 decimals
// (~0.11 m) is a formatting guard, not a snap tolerance.
const key = ([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`;

// ---------------------------------------------------------------------------
// Graph build + Dijkstra.

function buildGraph(segments) {
  const nodes = new Map(); // key -> coord
  const adj = new Map(); // key -> [{seg, from, to, weight}]
  for (const seg of segments) {
    const a = seg.coords[0];
    const b = seg.coords[seg.coords.length - 1];
    const ka = key(a);
    const kb = key(b);
    nodes.set(ka, a);
    nodes.set(kb, b);
    const weight = lineLengthMi(seg.coords);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push({ seg, from: ka, to: kb, weight });
    adj.get(kb).push({ seg, from: kb, to: ka, weight });
  }
  return { nodes, adj };
}

// Anchor node: a candidate-graph node that coincides with an endpoint of the
// crossing road (exact key match first, then within 25 m), nearest to the hint.
function resolveAnchor(graph, anchorEndpoints, hint, label) {
  const exact = [];
  for (const pt of anchorEndpoints) {
    const k = key(pt);
    if (graph.nodes.has(k)) exact.push(k);
  }
  let pool = exact;
  let method = "exact shared endpoint";
  if (pool.length === 0) {
    method = "nearest node within 25 m of crossing-road endpoint";
    const near = new Set();
    for (const [k, coord] of graph.nodes) {
      for (const pt of anchorEndpoints) {
        if (haversineMi(coord, pt) * 1609.344 <= 25) {
          near.add(k);
          break;
        }
      }
    }
    pool = [...near];
  }
  if (pool.length === 0) {
    throw new Error(`anchor "${label}": no candidate node meets the crossing road`);
  }
  pool.sort(
    (a, b) =>
      haversineMi(graph.nodes.get(a), hint) - haversineMi(graph.nodes.get(b), hint)
  );
  return { key: pool[0], method, coord: graph.nodes.get(pool[0]) };
}

function dijkstra(graph, startKey, endKey) {
  const dist = new Map([[startKey, 0]]);
  const prev = new Map(); // key -> {edge, from}
  const done = new Set();
  // Small graphs (tens to low hundreds of nodes): a linear-scan PQ is fine.
  while (true) {
    let u = null;
    let best = Infinity;
    for (const [k, d] of dist) {
      if (!done.has(k) && d < best) {
        best = d;
        u = k;
      }
    }
    if (u === null) break;
    if (u === endKey) break;
    done.add(u);
    for (const edge of graph.adj.get(u) ?? []) {
      const nd = best + edge.weight;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, { edge, from: u });
      }
    }
  }
  if (startKey !== endKey && !prev.has(endKey)) return null; // disconnected
  // Walk back, orienting each segment's coordinates from -> to.
  const edges = [];
  let cur = endKey;
  while (cur !== startKey) {
    const step = prev.get(cur);
    if (!step) return null;
    edges.unshift(step);
    cur = step.from;
  }
  const coords = [];
  const used = [];
  for (const { edge, from } of edges) {
    let c = edge.seg.coords;
    if (key(c[0]) !== from) c = [...c].reverse();
    for (const pt of c) {
      const last = coords[coords.length - 1];
      if (!last || last[0] !== pt[0] || last[1] !== pt[1]) coords.push(pt);
    }
    used.push(edge.seg);
  }
  return { coords, used };
}

// ---------------------------------------------------------------------------
// Trace each road.

const features = [];
const summaries = [];

for (const road of ROADS) {
  const candidates = fetchCandidates(road.candidateWhere);
  const graph = buildGraph(candidates);
  const anchors = road.anchors.map((a) =>
    resolveAnchor(graph, fetchAnchorEndpoints(a.where), a.hint, a.label)
  );
  const path = dijkstra(graph, anchors[0].key, anchors[1].key);
  if (!path) {
    throw new Error(
      `${road.sweep_id}: no continuous path between anchors — do not fake geometry; inspect candidates`
    );
  }
  const tracedMi = lineLengthMi(path.coords);
  const deltaPct = ((tracedMi - road.seed_length_mi) / road.seed_length_mi) * 100;
  const lengthFlag = Math.abs(deltaPct) > 20;

  features.push({
    type: "Feature",
    properties: {
      sweep_id: road.sweep_id,
      name: road.name,
      match_method: road.match_method,
      candidate_segments: candidates.length,
      used_segments: path.used.length,
      traced_length_mi: Number(tracedMi.toFixed(2)),
      seed_length_mi: road.seed_length_mi,
      length_delta_pct: Number(deltaPct.toFixed(1)),
      length_flag: lengthFlag,
      anchor_a: { label: road.anchors[0].label, method: anchors[0].method },
      anchor_b: { label: road.anchors[1].label, method: anchors[1].method },
      source: "Overture Maps transportation/segment release 2026-06-17.0",
      overture_segment_ids: path.used.map((s) => s.id),
    },
    geometry: { type: "LineString", coordinates: path.coords },
  });

  summaries.push({
    sweep_id: road.sweep_id,
    name: road.name,
    candidates: candidates.length,
    used: path.used.length,
    traced_mi: tracedMi.toFixed(2),
    seed_mi: road.seed_length_mi,
    delta_pct: deltaPct.toFixed(1),
    flag: lengthFlag ? "LENGTH OFF >20%" : "ok",
    anchors: anchors.map((a, i) => `${road.anchors[i].label} [${a.method}]`),
    names_used: [...new Set(path.used.map((s) => s.name))],
  });
}

const out = join(here, "prototype-traces.geojson");
writeFileSync(out, JSON.stringify({ type: "FeatureCollection", features }, null, 2));

for (const s of summaries) {
  console.log(`\n${s.sweep_id}  ${s.name}`);
  console.log(`  candidates ${s.candidates} -> used ${s.used} segments (LineString)`);
  console.log(`  length ${s.traced_mi} mi vs seed ${s.seed_mi} mi (${s.delta_pct}%)  ${s.flag}`);
  console.log(`  anchors: ${s.anchors.join(" | ")}`);
  console.log(`  names on path: ${s.names_used.join(", ")}`);
}
console.log(`\nwrote ${out}`);
