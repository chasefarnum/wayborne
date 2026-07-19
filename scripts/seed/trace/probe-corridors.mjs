// Corridor probe for the region-01 tracing scale-out: for each county/named
// road with no (or unknown) route ref, list the road names, classes, refs,
// and per-name mileage inside its corridor bbox. Output feeds the per-road
// name lists in trace-region-01.mjs; this script only reads the local
// parquet and prints. Same-name traps (three Sundown Roads) are why every
// name match is bbox-scoped — see README.
//
// Usage: node scripts/seed/trace/probe-corridors.mjs [sweep_id ...]
// Env:   OVERTURE_PARQUET to point at the local parquet.

import { execFileSync } from "node:child_process";

const PARQUET =
  process.env.OVERTURE_PARQUET ??
  "/private/tmp/claude-501/-Users-chasefarnum-claude-projects-personal-wayborne/b205c365-7408-4e1e-bd8d-025c7258929c/scratchpad/overture-transport-region01.parquet";

// [lonMin, latMin, lonMax, latMax] rough corridor boxes from the seed
// route_desc endpoints, padded.
const CORRIDORS = [
  ["r-004", "Frost Valley Road (CR-47 + Oliverea Rd)", [-74.62, 41.9, -74.38, 42.11]],
  ["r-006", "Platte Clove Road (Greene CR-16)", [-74.16, 42.09, -74.0, 42.21]],
  ["r-008", "Ohayo Mountain Road (Ulster CR-41)", [-74.18, 41.96, -74.08, 42.05]],
  ["r-019", "Debruce Road", [-74.85, 41.88, -74.68, 41.96]],
  ["r-020", "Willowemoc Road", [-74.74, 41.9, -74.53, 41.99]],
  ["r-021", "Old Route 17", [-74.95, 41.88, -74.8, 41.97]],
  ["r-022", "Beaverkill Road", [-74.92, 41.89, -74.77, 42.06]],
  ["r-023", "Barkaboom Road", [-74.93, 42.0, -74.79, 42.12]],
  ["r-024", "Mountaindale Road", [-74.62, 41.6, -74.47, 41.75]],
  ["r-025", "Ulster Heights Road", [-74.63, 41.68, -74.36, 41.8]],
  ["r-030", "Seven Lakes Drive", [-74.22, 41.13, -73.96, 41.33]],
  ["r-031", "Perkins Memorial Drive", [-74.02, 41.29, -73.96, 41.33]],
  ["r-035", "Dennytown Road", [-73.9, 41.36, -73.82, 41.44]],
  ["r-036", "NY-106 / Kanawauke Road", [-74.21, 41.2, -73.96, 41.3]],
  ["r-037", "Arden Valley Road", [-74.17, 41.26, -74.06, 41.32]],
  ["r-043", "Guymard Turnpike", [-74.65, 41.42, -74.4, 41.54]],
  ["r-046", "Dutchess CR-83", [-73.6, 41.84, -73.5, 42.0]],
  ["r-047", "CR-86 Bangall-Amenia Road", [-73.72, 41.83, -73.5, 41.93]],
  ["r-048", "Dutchess CR-24", [-73.75, 41.62, -73.55, 41.76]],
];

function duckdb(sql) {
  const out = execFileSync("duckdb", ["-json", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const clean = out.replace(/\x1b\[[0-9;]*m/g, "");
  const start = clean.search(/^\[/m);
  return start === -1 ? [] : JSON.parse(clean.slice(start));
}

const only = new Set(process.argv.slice(2));

for (const [id, label, [x0, y0, x1, y1]] of CORRIDORS) {
  if (only.size > 0 && !only.has(id)) continue;
  const rows = duckdb(`
    LOAD spatial;
    SELECT names."primary" AS name, class,
           list_distinct(flatten(list(coalesce([r.network || ' ' || r."ref" for r in routes], [])))) AS refs,
           count(*) AS segs,
           round(sum(ST_Length_Spheroid(geometry)) / 1609.344, 2) AS mi
    FROM '${PARQUET}'
    WHERE bbox.xmin >= ${x0} AND bbox.xmax <= ${x1}
      AND bbox.ymin >= ${y0} AND bbox.ymax <= ${y1}
      AND class IN ('secondary','tertiary','unclassified','residential')
    GROUP BY 1, 2
    HAVING mi > 0.5
    ORDER BY mi DESC
    LIMIT 25;
  `);
  console.log(`\n=== ${id} ${label} ===`);
  for (const r of rows) {
    const refs = Array.isArray(r.refs) && r.refs.length ? ` refs[${r.refs.join("; ")}]` : "";
    console.log(`  ${String(r.mi).padStart(6)} mi  ${r.segs} segs  ${r.class}  ${r.name ?? "(unnamed)"}${refs}`);
  }
}
