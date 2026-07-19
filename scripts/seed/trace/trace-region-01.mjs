// Region-01 segment tracing at scale — all 50 seeded roads (3 proven by the
// prototype re-run through the same engine for one canonical output).
// Source: Overture Maps transportation theme, release 2026-06-17.0
// (store-friendly CDLA-P), reduced to a local bbox parquet (README query;
// west edge -75.5 so NY-10 reaches Deposit). Never touches S3 or the
// database; output is region-01-traces.geojson next to this file.
//
// Method per road (proven on r-001/002/003, see README):
//   candidates (route ref, or names + corridor bbox) -> node graph on exact
//   shared endpoints -> two anchors -> Dijkstra -> length check vs seed.
//
// Engine additions over the prototype, per the README scaling traps:
//   - terminal anchors ({terminal: true}): corridor end with no crossing
//     route (state lines, hamlet dead-ends); nearest degree-1 node to the
//     hint. Trap 4.
//   - filler segments (filler: true): name-matched corridors drop their name
//     at municipal lines and short connector pieces (trap 7); filler adds
//     every drivable segment inside the corridor bbox at 4x weight, so
//     Dijkstra bridges real gaps without wandering off the named road.
//   - continue on failure: a road with no continuous path reports and moves
//     on; geometry is never faked.
//
// Usage: node scripts/seed/trace/trace-region-01.mjs [sweep_id ...]
//        (no args = all roads; ids = subset, merged into the output file)
// Env:   OVERTURE_PARQUET to point at a different local parquet.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PARQUET =
  process.env.OVERTURE_PARQUET ??
  "/private/tmp/claude-501/-Users-chasefarnum-claude-projects-personal-wayborne/b205c365-7408-4e1e-bd8d-025c7258929c/scratchpad/overture-transport-region01.parquet";

// --------------------------------------------------------------------------
// WHERE-clause helpers.

const ny = (ref) =>
  `len(list_filter(routes, r -> r.network = 'US:NY' AND r."ref" = '${ref}')) > 0`;
const us = (ref) =>
  `len(list_filter(routes, r -> r.network = 'US:US' AND r."ref" = '${ref}')) > 0`;
const interstate = (ref) =>
  `len(list_filter(routes, r -> r.network = 'US:I' AND r."ref" = '${ref}')) > 0`;
const county = (cty, ref) =>
  `len(list_filter(routes, r -> r.network = 'US:NY:${cty}' AND r."ref" = '${ref}')) > 0`;
const namesIn = (list) =>
  `names."primary" IN (${list.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ")})`;
// Intersects, not fully-inside: a corridor segment crossing the box edge
// must stay in the graph or the corridor disconnects at the boundary.
const inBbox = ([x0, y0, x1, y1]) =>
  `bbox.xmax >= ${x0} AND bbox.xmin <= ${x1} AND bbox.ymax >= ${y0} AND bbox.ymin <= ${y1}`;
const DRIVABLE = `class IN ('secondary','tertiary','unclassified','residential')`;
// Filler bridges junction areas too: state highways and expressway pieces
// (primary/trunk/motorway) carry the connectivity at big junctions, and the
// 4x weight penalty keeps them from ever being preferred over the corridor.
const ALL_CLASSES = `class IN ('motorway','trunk','primary','secondary','tertiary','unclassified','residential')`;

// --------------------------------------------------------------------------
// Road configs. Each: candidateWhere (+ optional bbox scoping baked in),
// anchors [{label, where, hint} | {label, hint, terminal: true}], optional
// filler bbox for gap bridging, match_method for provenance, note for
// adjudication context.

const ROADS = [
  // --- proven by the prototype, re-run for the canonical output ------------
  {
    sweep_id: "r-001",
    name: "NY-23A: Kaaterskill Clove",
    seed_length_mi: 34.5,
    match_method: "route ref 23A (US:NY), clipped Palenville..Prattsville via anchors",
    candidateWhere: ny("23A"),
    anchors: [
      { label: "NY-32A at Palenville", where: ny("32A"), hint: [-74.02, 42.175] },
      { label: "NY-23 at Prattsville", where: ny("23"), hint: [-74.43, 42.32] },
    ],
    note: "Seed 34.5 is the FULL 23A route figure; the described clove stretch is ~26 mi (prototype adjudication). Correct length_mi when seeding.",
  },
  {
    sweep_id: "r-002",
    name: "NY-214: Stony Clove Notch",
    seed_length_mi: 12.5,
    match_method: "route ref 214 (US:NY)",
    candidateWhere: ny("214"),
    anchors: [
      { label: "NY-28 near Phoenicia", where: ny("28"), hint: [-74.313, 42.081] },
      { label: "NY-23A near Hunter", where: ny("23A"), hint: [-74.21, 42.2] },
    ],
  },
  {
    sweep_id: "r-003",
    name: "Peekamoose Road (Ulster CR-42)",
    seed_length_mi: 18,
    match_method:
      "names (Watson Hollow/Peekamoose/County Line-Sundown/Sundown Road) in corridor bbox; no CR-42 ref in Overture",
    candidateWhere: `${namesIn(["Watson Hollow Road", "Peekamoose Road", "County Line-Sundown Road", "Sundown Road"])} AND ${DRIVABLE} AND ${inBbox([-74.56, 41.84, -74.24, 41.99])}`,
    anchors: [
      { label: "NY-28A at West Shokan", where: ny("28A"), hint: [-74.28, 41.95] },
      { label: "NY-55A near Grahamsville", where: ny("55A"), hint: [-74.51, 41.86] },
    ],
  },

  // --- state routes: ref matching, anchor-clipped --------------------------
  {
    sweep_id: "r-005",
    name: "NY-42 North: Deep Notch",
    seed_length_mi: 9,
    match_method: "route ref 42 (US:NY) north of lat 42.0 (r-026 owns the southern NY-42)",
    candidateWhere: `${ny("42")} AND bbox.ymin >= 42.0`,
    anchors: [
      { label: "NY-28 at Shandaken", where: ny("28"), hint: [-74.39, 42.12] },
      { label: "NY-23A at Lexington", where: ny("23A"), hint: [-74.37, 42.2] },
    ],
  },
  {
    sweep_id: "r-007",
    name: "NY-296: Hunter-Windham connector",
    seed_length_mi: 7.5,
    match_method: "route ref 296 (US:NY)",
    candidateWhere: ny("296"),
    anchors: [
      { label: "NY-23A at Hunter", where: ny("23A"), hint: [-74.21, 42.21] },
      { label: "NY-23 near Windham", where: ny("23"), hint: [-74.25, 42.31] },
    ],
  },
  {
    sweep_id: "r-009",
    name: "NY-28: Catskill Mountains Scenic Byway",
    seed_length_mi: 52,
    match_method: "route ref 28 (US:NY), Kingston roundabout to Margaretville via anchors",
    candidateWhere: ny("28"),
    anchors: [
      { label: "I-587 roundabout, Kingston", where: interstate("587"), hint: [-74.045, 41.936] },
      { label: "NY-30 at Margaretville", where: ny("30"), hint: [-74.65, 42.145] },
    ],
    note: "Seed 52 reads 'to Margaretville/Andes'; Kingston..Margaretville is the byway core (~45 mi). Expect a mild negative delta; adjudicate against route_desc, not the flag alone.",
  },
  {
    sweep_id: "r-010",
    name: "NY-28A: Ashokan Reservoir south shore",
    seed_length_mi: 17,
    match_method: "route ref 28A (US:NY)",
    candidateWhere: ny("28A"),
    anchors: [
      { label: "NY-28 at West Hurley", where: ny("28"), hint: [-74.104, 41.996] },
      { label: "NY-28 at Boiceville", where: ny("28"), hint: [-74.27, 42.0] },
    ],
  },
  {
    sweep_id: "r-011",
    name: "NY-30: Pepacton Reservoir run",
    seed_length_mi: 26,
    match_method: "route ref 30 (US:NY), Margaretville..Downsville via anchors",
    candidateWhere: ny("30"),
    anchors: [
      { label: "NY-28 at Margaretville", where: ny("28"), hint: [-74.65, 42.145] },
      { label: "NY-206 at Downsville", where: ny("206"), hint: [-74.99, 42.08] },
    ],
  },
  {
    sweep_id: "r-012",
    name: "NY-30 North: Grand Gorge to Margaretville",
    seed_length_mi: 19,
    match_method: "route ref 30 (US:NY), Grand Gorge..Margaretville via anchors",
    candidateWhere: ny("30"),
    anchors: [
      { label: "NY-23 at Grand Gorge", where: ny("23"), hint: [-74.51, 42.36] },
      { label: "NY-28 at Margaretville", where: ny("28"), hint: [-74.65, 42.145] },
    ],
  },
  {
    sweep_id: "r-013",
    name: "NY-23: Mohican Trail",
    seed_length_mi: 35,
    match_method: "route ref 23 (US:NY), Catskill (US-9W)..Prattsville via anchors",
    candidateWhere: ny("23"),
    anchors: [
      { label: "US-9W at Catskill", where: us("9W"), hint: [-73.87, 42.22] },
      { label: "NY-23A at Prattsville", where: ny("23A"), hint: [-74.43, 42.32] },
    ],
  },
  {
    sweep_id: "r-014",
    name: "NY-206: Roscoe over Bear Spring Mountain to Walton",
    seed_length_mi: 28,
    match_method: "route ref 206 (US:NY)",
    candidateWhere: ny("206"),
    anchors: [
      { label: "NY-17 at Roscoe", where: ny("17"), hint: [-74.91, 41.93] },
      { label: "NY-10 at Walton", where: ny("10"), hint: [-75.13, 42.17] },
    ],
  },
  {
    sweep_id: "r-015",
    name: "NY-10: Walton to Deposit (Cannonsville Reservoir)",
    seed_length_mi: 27,
    match_method: "route ref 10 (US:NY); needs the -75.5 west parquet edge (Deposit)",
    candidateWhere: ny("10"),
    anchors: [
      { label: "NY-206 at Walton", where: ny("206"), hint: [-75.13, 42.17] },
      { label: "NY-8/NY-17 area at Deposit", where: ny("8"), hint: [-75.42, 42.06] },
    ],
  },
  {
    sweep_id: "r-016",
    name: "NY-55A: Rondout Reservoir north shore",
    seed_length_mi: 9,
    match_method: "route ref 55A (US:NY)",
    candidateWhere: ny("55A"),
    anchors: [
      { label: "NY-55 near Grahamsville", where: ny("55"), hint: [-74.56, 41.85] },
      { label: "NY-55 near Napanoch", where: ny("55"), hint: [-74.42, 41.79] },
    ],
  },
  {
    sweep_id: "r-017",
    name: "NY-55: Neversink / Rondout section",
    seed_length_mi: 15,
    match_method: "route ref 55 (US:NY), Liberty..Napanoch via anchors",
    candidateWhere: ny("55"),
    anchors: [
      { label: "NY-52 at Liberty", where: ny("52"), hint: [-74.75, 41.8] },
      { label: "US-209 at Napanoch", where: us("209"), hint: [-74.37, 41.74] },
    ],
  },
  {
    sweep_id: "r-018",
    name: "NY-52 West: Narrowsburg to Liberty to Ellenville",
    seed_length_mi: 47,
    match_method: "route ref 52 (US:NY), Narrowsburg..Ellenville via anchors",
    candidateWhere: ny("52"),
    anchors: [
      { label: "NY-97 at Narrowsburg", where: ny("97"), hint: [-75.06, 41.61] },
      { label: "US-209 at Ellenville", where: us("209"), hint: [-74.39, 41.72] },
    ],
  },
  {
    sweep_id: "r-026",
    name: "NY-42 South: Sparrowbush to Forestburgh to Monticello",
    seed_length_mi: 14,
    match_method: "route ref 42 (US:NY) south of lat 41.75 (r-005 owns Deep Notch)",
    candidateWhere: `${ny("42")} AND bbox.ymax <= 41.663`,
    anchors: [
      { label: "NY-97 at Sparrowbush", where: ny("97"), hint: [-74.72, 41.4] },
      { label: "Monticello end", hint: [-74.689, 41.653], terminal: true },
    ],
  },
  {
    sweep_id: "r-027",
    name: "NY-97: Upper Delaware Scenic Byway",
    seed_length_mi: 70.5,
    match_method: "route ref 97 (US:NY), Port Jervis..Hancock via anchors",
    candidateWhere: ny("97"),
    anchors: [
      { label: "Port Jervis terminus", hint: [-74.687, 41.375], terminal: true },
      { label: "NY-17 at Hancock", where: ny("17"), hint: [-75.28, 41.95] },
    ],
  },
  {
    sweep_id: "r-028",
    name: "Hawk's Nest (NY-97 cliff section)",
    seed_length_mi: 2.1,
    match_method: "route ref 97 (US:NY) clipped by the cliff-section bbox, terminal ends",
    candidateWhere: `${ny("97")} AND ${inBbox([-74.76, 41.375, -74.7, 41.415])}`,
    diameter: true,
    note: "Cliff-section bounds are editorial (seed 2.1 mi); adjudicate the traced clip against the described curves, not just the delta.",
  },
  {
    sweep_id: "r-029",
    name: "NY-218: Storm King Highway",
    seed_length_mi: 3,
    match_method: "route ref 218 (US:NY), cliff segment via US-9W anchors both ends",
    candidateWhere: `${ny("218")} AND ${inBbox([-74.01, 41.415, -73.97, 41.447])}`,
    diameter: true,
  },
  {
    sweep_id: "r-032",
    name: "The Goat Trail (US-6/202 Bear Mountain Bridge Road)",
    seed_length_mi: 3,
    match_method: "route ref 6 (US:US) in the Anthony's Nose corridor bbox",
    candidateWhere: `${us("6")} AND ${inBbox([-73.99, 41.28, -73.9, 41.33])}`,
    anchors: [
      { label: "Bear Mountain Bridge east end", where: ny("9D"), hint: [-73.979, 41.32] },
      { label: "US-9 side, Peekskill", where: us("9"), hint: [-73.92, 41.29] },
    ],
  },
  {
    sweep_id: "r-033",
    name: "NY-9D: Hudson Highlands",
    seed_length_mi: 15,
    match_method: "route ref 9D (US:NY), bridge..Beacon via anchors",
    candidateWhere: ny("9D"),
    anchors: [
      { label: "Bear Mountain Bridge (Anthony's Nose)", where: us("6"), hint: [-73.979, 41.32] },
      { label: "NY-52 at Beacon", where: ny("52"), hint: [-73.97, 41.5] },
    ],
  },
  {
    sweep_id: "r-034",
    name: "NY-301 through Fahnestock",
    seed_length_mi: 17,
    match_method: "route ref 301 (US:NY)",
    candidateWhere: ny("301"),
    anchors: [
      { label: "NY-9D at Cold Spring", where: ny("9D"), hint: [-73.95, 41.42] },
      { label: "NY-52 at Carmel", where: ny("52"), hint: [-73.68, 41.43] },
    ],
  },
  {
    sweep_id: "r-038",
    name: "NY-17A + NY-210: Greenwood Lake loop",
    seed_length_mi: 15,
    match_method: "route refs 17A + 210 (US:NY); NJ-line end is a terminal anchor",
    candidateWhere: `(${ny("17A")} OR ${ny("210")}) AND ${inBbox([-74.4, 41.15, -74.1, 41.32])}`,
    anchors: [
      { label: "NY-17 at Southfields/Tuxedo", where: ny("17"), hint: [-74.2, 41.24] },
      { label: "NJ line, Greenwood Lake west shore", hint: [-74.31, 41.18], terminal: true },
    ],
  },
  {
    sweep_id: "r-039",
    name: "US-44/NY-55: the Gunks crossing",
    seed_length_mi: 16.4,
    match_method: "route ref 44 (US:US), Gardiner..Kerhonkson via anchors",
    candidateWhere: us("44"),
    anchors: [
      { label: "NY-208 at Ireland Corners/Gardiner", where: ny("208"), hint: [-74.17, 41.68] },
      { label: "US-209 near Kerhonkson", where: us("209"), hint: [-74.3, 41.77] },
    ],
  },
  {
    sweep_id: "r-040",
    name: "NY-299: New Paltz approach",
    seed_length_mi: 6,
    match_method: "route ref 299 (US:NY)",
    candidateWhere: ny("299"),
    anchors: [
      { label: "NY-32 at New Paltz village", where: ny("32"), hint: [-74.08, 41.75] },
      { label: "US-44/NY-55 junction at Gardiner", where: us("44"), hint: [-74.15, 41.68] },
    ],
  },
  {
    sweep_id: "r-041",
    name: "NY-52: Ellenville climb",
    seed_length_mi: 9,
    match_method: "route ref 52 (US:NY), Ellenville..Pine Bush via anchors",
    candidateWhere: ny("52"),
    anchors: [
      { label: "US-209 at Ellenville", where: us("209"), hint: [-74.39, 41.71] },
      { label: "NY-302 at Pine Bush", where: ny("302"), hint: [-74.3, 41.62] },
    ],
  },
  {
    sweep_id: "r-044",
    name: "NY-9G: Rhinebeck to Hudson/Olana",
    seed_length_mi: 25,
    match_method: "route ref 9G (US:NY), Rhinebeck..Rip Van Winkle Bridge via anchors",
    candidateWhere: ny("9G"),
    anchors: [
      { label: "US-9 area at Rhinebeck", where: us("9"), hint: [-73.91, 41.93] },
      { label: "NY-23 at the Rip Van Winkle Bridge", where: ny("23"), hint: [-73.85, 42.22] },
    ],
  },
  {
    sweep_id: "r-045",
    name: "NY-82",
    seed_length_mi: 30,
    match_method: "route ref 82 (US:NY), Hopewell Junction..Pine Plains via anchors",
    candidateWhere: ny("82"),
    anchors: [
      { label: "NY-52 at Hopewell Junction", where: ny("52"), hint: [-73.8, 41.58] },
      { label: "NY-199 at Pine Plains", where: ny("199"), hint: [-73.65, 41.98] },
    ],
  },
  {
    sweep_id: "r-049",
    name: "NY-22: Harlem Valley",
    seed_length_mi: 30,
    match_method: "route ref 22 (US:NY), Pawling..Millerton via anchors",
    candidateWhere: ny("22"),
    anchors: [
      { label: "NY-55 at Pawling", where: ny("55"), hint: [-73.6, 41.56] },
      { label: "US-44 at Millerton", where: us("44"), hint: [-73.51, 41.95] },
    ],
    note: "NY-22/NY-343 run concurrent near Amenia (r-050 shares segments); fine for geometry, dedupe when counting.",
  },
  {
    sweep_id: "r-050",
    name: "NY-343: Amenia to Sharon CT",
    seed_length_mi: 5,
    match_method: "route ref 343 (US:NY); CT-line end is a terminal anchor",
    candidateWhere: ny("343"),
    anchors: [
      { label: "NY-22 at Amenia", where: ny("22"), hint: [-73.555, 41.848] },
      { label: "CT line east of Amenia", hint: [-73.49, 41.88], terminal: true },
    ],
  },
  {
    sweep_id: "r-036",
    name: "NY-106 / Kanawauke Road across Harriman",
    seed_length_mi: 10,
    match_method: "county refs Orange/Rockland 106 (Kanawauke + Gate Hill + Central Drive), anchors clip (seeded hold)",
    candidateWhere: `(${county("Orange", "106")} OR ${county("Rockland", "106")})`,
    anchors: [
      { label: "US-9W side, Stony Point", where: us("9W"), hint: [-73.99, 41.23] },
      { label: "NY-17 near Southfields", where: ny("17"), hint: [-74.19, 41.25] },
    ],
  },

  // --- county / named corridors: names + bbox (+ filler), probe-confirmed --
  {
    sweep_id: "r-004",
    name: "Frost Valley Road (Ulster CR-47 + Oliverea Rd)",
    seed_length_mi: 19,
    match_method: "county ref US:NY:Ulster 47 (probe: Frost Valley Rd + Oliverea Rd both carry it) + filler",
    candidateWhere: `(${county("Ulster", "47")} OR ${namesIn(["Frost Valley Road", "Oliverea Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.62, 41.9, -74.38, 42.11])}`,
    filler: [-74.62, 41.9, -74.38, 42.11],
    anchors: [
      { label: "Claryville Road (Sullivan CR-19)", where: county("Sullivan", "19"), hint: [-74.58, 41.93] },
      { label: "NY-28 at Big Indian", where: ny("28"), hint: [-74.45, 42.09] },
    ],
  },
  {
    sweep_id: "r-006",
    name: "Platte Clove Road (Greene CR-16)",
    seed_length_mi: 10,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `(${county("Greene", "16")} OR ${namesIn(["Platte Clove Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.16, 42.09, -74.0, 42.21])}`,
    filler: [-74.16, 42.09, -74.0, 42.21],
    anchors: [
      { label: "NY-23A at Tannersville", where: ny("23A"), hint: [-74.13, 42.19] },
      { label: "West Saugerties end", hint: [-74.03, 42.12], terminal: true },
    ],
  },
  {
    sweep_id: "r-008",
    name: "Ohayo Mountain Road (Ulster CR-41)",
    seed_length_mi: 6,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `(${county("Ulster", "41")} OR ${namesIn(["Ohayo Mountain Road", "Upper West Ohayo Mountain Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.18, 41.96, -74.06, 42.05])}`,
    filler: [-74.18, 41.96, -74.06, 42.05],
    anchors: [
      { label: "NY-212 side, Woodstock", where: ny("212"), hint: [-74.11, 42.03] },
      { label: "NY-28 near Glenford/Ashokan", where: ny("28"), hint: [-74.14, 41.98] },
    ],
  },
  {
    sweep_id: "r-019",
    name: "Debruce Road",
    seed_length_mi: 7,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `(${county("Sullivan", "81")} OR ${county("Sullivan", "82")} OR ${namesIn(["Debruce Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.85, 41.88, -74.68, 41.96])}`,
    filler: [-74.85, 41.88, -74.68, 41.96],
    anchors: [
      { label: "Old Route 17 at Livingston Manor", where: `(${county("Sullivan", "178")} OR ${county("Sullivan", "179")}) AND ${inBbox([-74.9, 41.86, -74.76, 41.96])}`, hint: [-74.83, 41.9] },
      { label: "Willowemoc Road at Debruce", where: `names."primary" = 'Willowemoc Road' AND ${inBbox([-74.78, 41.88, -74.62, 41.98])}`, hint: [-74.72, 41.925] },
    ],
  },
  {
    sweep_id: "r-020",
    name: "Willowemoc Road",
    seed_length_mi: 12,
    match_method:
      "names + corridor bbox with filler (README trap 7: named pieces total ~4.6 mi, corridor continues under other names)",
    candidateWhere: `${namesIn(["Willowemoc Road"])} AND class IN ('secondary','tertiary','unclassified','residential') AND ${inBbox([-74.78, 41.88, -74.53, 41.99])}`,
    filler: [-74.78, 41.88, -74.53, 41.99],
    anchors: [
      { label: "Debruce Road junction (Sullivan CR-81/82)", where: `(${county("Sullivan", "81")} OR ${county("Sullivan", "82")}) AND ${inBbox([-74.85, 41.88, -74.68, 41.96])}`, hint: [-74.72, 41.925] },
      { label: "Fluggertown Road at Willowemoc hamlet", where: `names."primary" = 'Fluggertown Road' AND ${inBbox([-74.63, 41.9, -74.53, 41.99])}`, hint: [-74.575, 41.94] },
    ],
  },
  {
    sweep_id: "r-021",
    name: "Old Route 17: Livingston Manor to Roscoe",
    seed_length_mi: 9,
    match_method: "names + corridor bbox with filler (discontinuous naming expected)",
    candidateWhere: `(${county("Sullivan", "178")} OR ${county("Sullivan", "179")} OR ${namesIn(["Old Route 17", "Main Street"])}) AND ${DRIVABLE} AND ${inBbox([-74.95, 41.88, -74.8, 41.97])}`,
    filler: [-74.95, 41.88, -74.8, 41.97],
    anchors: [
      { label: "Livingston Manor", hint: [-74.828, 41.898], terminal: true },
      { label: "Roscoe", hint: [-74.914, 41.932], terminal: true },
    ],
  },
  {
    sweep_id: "r-022",
    name: "Beaverkill Road",
    seed_length_mi: 14,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `(${county("Sullivan", "151")} OR ${county("Sullivan", "152")} OR ${namesIn(["Beaverkill Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.92, 41.89, -74.72, 42.08])}`,
    filler: [-74.92, 41.89, -74.72, 42.08],
    anchors: [
      { label: "Old Route 17 at Livingston Manor", where: `(${county("Sullivan", "178")} OR ${county("Sullivan", "179")}) AND ${inBbox([-74.9, 41.86, -74.76, 41.96])}`, hint: [-74.83, 41.9] },
      { label: "Turnwood (Barkaboom junction)", hint: [-74.77, 42.02], terminal: true },
    ],
  },
  {
    sweep_id: "r-023",
    name: "Barkaboom Road",
    seed_length_mi: 7,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `${namesIn(["Barkaboom Road"])} AND ${DRIVABLE} AND ${inBbox([-74.78, 42.02, -74.71, 42.11])}`,
    filler: [-74.78, 42.02, -74.71, 42.11],
    diameter: true,
  },
  {
    sweep_id: "r-024",
    name: "Mountaindale Road",
    seed_length_mi: 8,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `(${county("Sullivan", "54")} OR ${county("Sullivan", "55")} OR ${namesIn(["Mountaindale Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.62, 41.6, -74.47, 41.75])}`,
    filler: [-74.62, 41.6, -74.47, 41.75],
    anchors: [
      { label: "Spring Glen end", hint: [-74.505, 41.625], terminal: true },
      { label: "Woodridge end", hint: [-74.575, 41.713], terminal: true },
    ],
  },
  {
    sweep_id: "r-025",
    name: "Ulster Heights Road",
    seed_length_mi: 10,
    match_method: "names + corridor bbox with filler",
    candidateWhere: `(${county("Ulster", "52")} OR ${namesIn(["Ulster Heights Road"])}) AND ${DRIVABLE} AND ${inBbox([-74.63, 41.68, -74.36, 41.8])}`,
    filler: [-74.63, 41.68, -74.36, 41.8],
    anchors: [
      { label: "NY-52 southeast of Ellenville", where: ny("52"), hint: [-74.365, 41.705] },
      { label: "NY-42 at Woodbourne", where: ny("42"), hint: [-74.59, 41.76] },
    ],
  },
  {
    sweep_id: "r-030",
    name: "Seven Lakes Drive",
    seed_length_mi: 18,
    match_method: "name + corridor bbox with filler (seeded hold)",
    candidateWhere: `${namesIn(["Seven Lakes Drive"])} AND ${DRIVABLE} AND ${inBbox([-74.22, 41.13, -73.96, 41.33])}`,
    filler: [-74.22, 41.13, -73.96, 41.33],
    anchors: [
      { label: "NY-17 at Sloatsburg", where: ny("17"), hint: [-74.19, 41.16] },
      { label: "Bear Mountain Circle (US-9W)", where: us("9W"), hint: [-73.99, 41.31] },
    ],
  },
  {
    sweep_id: "r-031",
    name: "Perkins Memorial Drive",
    seed_length_mi: 4,
    match_method: "name + corridor bbox (seeded hold); summit end is terminal",
    candidateWhere: `${namesIn(["Perkins Memorial Drive"])} AND class IN ('secondary','tertiary','unclassified','residential','service') AND ${inBbox([-74.02, 41.29, -73.96, 41.33])}`,
    diameter: true,
  },
  {
    sweep_id: "r-035",
    name: "Dennytown Road",
    seed_length_mi: 5,
    match_method: "name + corridor bbox with filler",
    candidateWhere: `${namesIn(["Dennytown Road", "Oscawana Lake Road"])} AND ${DRIVABLE} AND ${inBbox([-73.9, 41.34, -73.8, 41.44])}`,
    filler: [-73.9, 41.34, -73.8, 41.44],
    anchors: [
      { label: "NY-301 in Fahnestock", where: ny("301"), hint: [-73.85, 41.43] },
      { label: "Peekskill Hollow Road (Putnam CR-21)", where: county("Putnam", "21"), hint: [-73.86, 41.36] },
    ],
    note: "Seed 5 mi reads as the Dennytown + Oscawana Lake chain down to Peekskill Hollow (named Dennytown piece alone is 1.25 mi).",
  },
  {
    sweep_id: "r-037",
    name: "Arden Valley Road",
    seed_length_mi: 4,
    match_method: "name + corridor bbox with filler",
    candidateWhere: `${namesIn(["Arden Valley Road"])} AND ${DRIVABLE} AND ${inBbox([-74.17, 41.26, -74.06, 41.32])}`,
    filler: [-74.17, 41.26, -74.06, 41.32],
    anchors: [
      { label: "Tiorati Circle end", hint: [-74.09, 41.29], terminal: true },
      { label: "Arden (NY-17) end", hint: [-74.16, 41.3], terminal: true },
    ],
  },
  {
    sweep_id: "r-042",
    name: "NY-213 / Lucas Turnpike",
    seed_length_mi: 10,
    match_method: "route ref 213 (US:NY) plus Lucas Turnpike by name, with filler",
    candidateWhere: `(${ny("213")} OR (${namesIn(["Lucas Turnpike", "Lucas Avenue Extension", "Lucas Avenue"])} AND ${DRIVABLE})) AND ${inBbox([-74.28, 41.75, -74.03, 41.9])}`,
    filler: [-74.28, 41.75, -74.03, 41.9],
    anchors: [
      { label: "US-209 near Accord/Kerhonkson", where: us("209"), hint: [-74.23, 41.79] },
      { label: "NY-32 at Rosendale", where: ny("32"), hint: [-74.07, 41.85] },
    ],
  },
  {
    sweep_id: "r-043",
    name: "Guymard Turnpike",
    seed_length_mi: 8,
    match_method: "name + corridor bbox with filler",
    candidateWhere: `(${county("Orange", "24")} OR ${namesIn(["Guymard Turnpike"])}) AND ${DRIVABLE} AND ${inBbox([-74.65, 41.42, -74.4, 41.54])}`,
    filler: [-74.65, 41.42, -74.4, 41.54],
    anchors: [
      { label: "US-209 at Cuddebackville", where: us("209"), hint: [-74.6, 41.47] },
      { label: "Mount Hope Road (Orange CR-11)", where: county("Orange", "11"), hint: [-74.48, 41.46] },
    ],
  },
  {
    sweep_id: "r-046",
    name: "Dutchess CR-83",
    seed_length_mi: 12,
    match_method: "county ref US:NY:Dutchess 83, else names from probe",
    candidateWhere: `(${county("Dutchess", "83")} OR (${namesIn(["Smithfield Valley Road", "Sn Fri Road"])} AND ${DRIVABLE})) AND ${inBbox([-73.75, 41.82, -73.48, 42.02])}`,
    filler: [-73.75, 41.82, -73.48, 42.02],
    anchors: [
      { label: "Amenia (US-44/NY-343 side)", where: us("44"), hint: [-73.55, 41.85] },
      { label: "NY-199 near Pine Plains", where: ny("199"), hint: [-73.62, 41.99] },
    ],
    note: "Overture CR-83 = Smithfield Valley Rd + Sn Fri Rd; filler bridges the rest. Adjudicate the path against route_desc.",
  },
  {
    sweep_id: "r-047",
    name: "CR-86: Bangall-Amenia Road",
    seed_length_mi: 10,
    match_method: "county ref US:NY:Dutchess 86, else Bangall Amenia Road by name",
    candidateWhere: `(${county("Dutchess", "86")} OR (${namesIn(["Bangall Amenia Road"])} AND ${DRIVABLE})) AND ${inBbox([-73.75, 41.83, -73.5, 41.95])}`,
    filler: [-73.75, 41.83, -73.5, 41.95],
    anchors: [
      { label: "NY-82 at Stanfordville", where: ny("82"), hint: [-73.71, 41.88] },
      { label: "US-44 near Amenia/Millbrook", where: us("44"), hint: [-73.56, 41.84] },
    ],
  },
  {
    sweep_id: "r-048",
    name: "Dutchess CR-24",
    seed_length_mi: 15,
    match_method: "county ref US:NY:Dutchess 24, else names from probe",
    candidateWhere: `(${county("Dutchess", "24")} OR (${namesIn(["Chestnut Ridge Road", "Halls Corners Road"])} AND ${DRIVABLE})) AND ${inBbox([-73.78, 41.6, -73.53, 41.78])}`,
    filler: [-73.78, 41.6, -73.53, 41.78],
    anchors: [
      { label: "NY-343 at Dover Plains", where: ny("343"), hint: [-73.58, 41.74] },
      { label: "Lagrangeville", hint: [-73.73, 41.63], terminal: true },
    ],
    note: "Probe the corridor before trusting the name fallbacks; CR-24's road names are unconfirmed.",
  },
];

// --------------------------------------------------------------------------
// DuckDB access.

function duckdb(sql) {
  const out = execFileSync("duckdb", ["-json", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const clean = out.replace(/\x1b\[[0-9;]*m/g, "");
  const start = clean.search(/^\[/m);
  return start === -1 ? [] : JSON.parse(clean.slice(start));
}

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
    coords: asGeoJson(r.gj).coordinates,
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

// --------------------------------------------------------------------------
// Geometry + graph (prototype machinery, filler-aware weights).

const R_MI = 3958.7613;
function haversineMi([lon1, lat1], [lon2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MI * Math.asin(Math.sqrt(a));
}
const pathLengthMi = (coords) =>
  coords.reduce((mi, c, i) => (i ? mi + haversineMi(coords[i - 1], c) : 0), 0);
const key = ([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`;

// Filler segments carry a 4x weight penalty: Dijkstra bridges genuine naming
// gaps but never prefers an unnamed shortcut over the named corridor.
const FILLER_PENALTY = 4;

function buildGraph(segments) {
  const nodes = new Map();
  const adj = new Map();
  for (const seg of segments) {
    const a = seg.coords[0];
    const b = seg.coords[seg.coords.length - 1];
    const ka = key(a);
    const kb = key(b);
    nodes.set(ka, a);
    nodes.set(kb, b);
    const weight = pathLengthMi(seg.coords) * (seg.filler ? FILLER_PENALTY : 1);
    if (!adj.has(ka)) adj.set(ka, []);
    if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push({ seg, from: ka, to: kb, weight });
    adj.get(kb).push({ seg, from: kb, to: ka, weight });
  }
  return { nodes, adj };
}

// Anchors resolve against the NAMED corridor's nodes first; the full
// (filler-bearing) graph is only a fallback. Anchoring on a filler node can
// land miles from the corridor and drag the path down highways.
function poolFor(graph, anchorEndpoints, radiusM) {
  if (radiusM === 0) {
    const exact = [];
    for (const pt of anchorEndpoints) {
      const k = key(pt);
      if (graph.nodes.has(k)) exact.push(k);
    }
    return exact;
  }
  const near = new Set();
  for (const [k, coord] of graph.nodes) {
    for (const pt of anchorEndpoints) {
      if (haversineMi(coord, pt) * 1609.344 <= radiusM) {
        near.add(k);
        break;
      }
    }
  }
  return [...near];
}

function resolveAnchor(namedGraph, fullGraph, anchorEndpoints, hint, label) {
  const tiers = [
    [namedGraph, 0, "exact shared endpoint"],
    [namedGraph, 25, "within 25 m of crossing-road endpoint"],
    [namedGraph, 250, "within 250 m of crossing-road endpoint (grade-separated)"],
    [fullGraph, 0, "exact shared endpoint (via filler)"],
    [fullGraph, 250, "within 250 m of crossing-road endpoint (via filler)"],
  ];
  for (const [graph, radius, method] of tiers) {
    const pool = poolFor(graph, anchorEndpoints, radius);
    if (pool.length > 0) {
      pool.sort(
        (a, b) =>
          haversineMi(graph.nodes.get(a), hint) - haversineMi(graph.nodes.get(b), hint)
      );
      return { key: pool[0], method, coord: graph.nodes.get(pool[0]) };
    }
  }
  throw new Error(`anchor "${label}": no candidate node meets the crossing road`);
}

// Terminal anchor: corridor end with no crossing route. Prefer degree-1
// nodes (dead ends / where the matched corridor stops) nearest the hint.
function resolveTerminalAnchor(graph, hint, label) {
  const entries = [...graph.nodes.entries()];
  if (entries.length === 0) throw new Error(`anchor "${label}": empty graph`);
  // Degree counts named (non-filler) edges only, so the corridor's own end
  // still reads as terminal when filler adds side streets.
  const namedDegree = (k) =>
    (graph.adj.get(k) ?? []).filter((e) => !e.seg.filler).length;
  const deg1 = entries.filter(([k]) => namedDegree(k) === 1);
  const pool = deg1.length > 0 ? deg1 : entries;
  pool.sort((a, b) => haversineMi(a[1], hint) - haversineMi(b[1], hint));
  const [k, coord] = pool[0];
  const distMi = haversineMi(coord, hint);
  return {
    key: k,
    method: `terminal node nearest hint (${deg1.length > 0 ? "degree-1" : "any"}, ${distMi.toFixed(2)} mi off hint)`,
    coord,
  };
}

function dijkstra(graph, startKey, endKey) {
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const done = new Set();
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
  if (startKey !== endKey && !prev.has(endKey)) return null;
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

// --------------------------------------------------------------------------
// Run.

const OUT = join(here, "region-01-traces.geojson");
const requested = new Set(process.argv.slice(2));
const roads = requested.size > 0 ? ROADS.filter((r) => requested.has(r.sweep_id)) : ROADS;

const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8")).features.filter(
      (f) => !roads.some((r) => r.sweep_id === f.properties.sweep_id)
    )
  : [];

const features = [];
const failures = [];

for (const road of roads) {
  try {
    const candidates = fetchCandidates(road.candidateWhere);
    if (candidates.length === 0) throw new Error("zero candidate segments");
    const candidateIds = new Set(candidates.map((c) => c.id));
    let segments = candidates;
    if (road.filler) {
      const fill = fetchCandidates(
        `${ALL_CLASSES} AND ${inBbox(road.filler)}`
      ).filter((s) => !candidateIds.has(s.id));
      for (const s of fill) s.filler = true;
      segments = [...candidates, ...fill];
    }
    const graph = buildGraph(segments);
    if (road.diameter) {
      // Longest shortest-path across the candidate graph: the natural spine
      // of a self-contained drive (e.g. a summit spur ending in a loop).
      const namedGraph = buildGraph(candidates);
      const compOf = new Map();
      let cidD = 0;
      for (const start of namedGraph.nodes.keys()) {
        if (compOf.has(start)) continue;
        cidD++;
        const stack = [start];
        while (stack.length) {
          const n = stack.pop();
          if (compOf.has(n)) continue;
          compOf.set(n, cidD);
          for (const e of namedGraph.adj.get(n) ?? []) stack.push(e.to);
        }
      }
      const sizesD = new Map();
      for (const c of compOf.values()) sizesD.set(c, (sizesD.get(c) ?? 0) + 1);
      const bigC = [...sizesD.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const keys = [...namedGraph.nodes.keys()].filter((k) => compOf.get(k) === bigC);
      const far = (from) => {
        let bestK = from;
        let bestD = -1;
        for (const k of keys) {
          const p = dijkstra(namedGraph, from, k);
          if (p) {
            const d = pathLengthMi(p.coords);
            if (d > bestD) {
              bestD = d;
              bestK = k;
            }
          }
        }
        return bestK;
      };
      const a = far(keys[0]);
      const b = far(a);
      road.anchors = [
        { label: "diameter end A", hint: namedGraph.nodes.get(a) },
        { label: "diameter end B", hint: namedGraph.nodes.get(b) },
      ];
      road._diameterKeys = [a, b];
    }
    const namedGraph = buildGraph(candidates);
    const anchors = road._diameterKeys
      ? road._diameterKeys.map((k) => ({
          key: k,
          method: "diameter endpoint",
          coord: namedGraph.nodes.get(k),
        }))
      : road.anchors.map((a) =>
          a.terminal
            ? resolveTerminalAnchor(namedGraph, a.hint, a.label)
            : resolveAnchor(namedGraph, graph, fetchAnchorEndpoints(a.where), a.hint, a.label)
        );
    // A terminal anchor's node exists in the full graph too (same keys).
    let path = dijkstra(graph, anchors[0].key, anchors[1].key);
    let autoFiller = false;
    let lastGraph = graph;
    if (!path) {
      // Second chance: ref chains break at concurrencies (segments carrying
      // only the partner ref) and corridors at bbox edges. Fill with every
      // drivable segment inside the candidates' padded extent, 4x weight.
      autoFiller = true;
      const lons = segments.flatMap((s) => [s.coords[0][0], s.coords[s.coords.length - 1][0]]);
      const lats = segments.flatMap((s) => [s.coords[0][1], s.coords[s.coords.length - 1][1]]);
      const pad = 0.02;
      const auto = [
        Math.min(...lons) - pad,
        Math.min(...lats) - pad,
        Math.max(...lons) + pad,
        Math.max(...lats) + pad,
      ];
      const ids = new Set(segments.map((s) => s.id));
      const fill = fetchCandidates(`${ALL_CLASSES} AND ${inBbox(auto)}`).filter(
        (s) => !ids.has(s.id)
      );
      for (const s of fill) s.filler = true;
      const graph2 = buildGraph([...segments, ...fill]);
      lastGraph = graph2;
      path = dijkstra(graph2, anchors[0].key, anchors[1].key);
    }
    if (!path) {
      // Diagnose before failing: which component holds each anchor, how big.
      const comp = new Map();
      let cid = 0;
      for (const start of lastGraph.nodes.keys()) {
        if (comp.has(start)) continue;
        cid++;
        const stack = [start];
        while (stack.length) {
          const n = stack.pop();
          if (comp.has(n)) continue;
          comp.set(n, cid);
          for (const e of lastGraph.adj.get(n) ?? []) stack.push(e.to);
        }
      }
      const sizes = new Map();
      for (const c of comp.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);
      const ca = comp.get(anchors[0].key);
      const cb = comp.get(anchors[1].key);
      throw new Error(
        `no continuous path between anchors (even with auto-filler); ` +
          `anchor A in component ${ca} (${sizes.get(ca)} nodes at ${anchors[0].coord.map((v) => v.toFixed(3))}), ` +
          `anchor B in component ${cb} (${sizes.get(cb)} nodes at ${anchors[1].coord.map((v) => v.toFixed(3))}), ` +
          `${sizes.size} components total, largest ${Math.max(...sizes.values())}`
      );
    }

    const fillerUsed = path.used.filter((s) => s.filler);
    const tracedMi = pathLengthMi(path.coords);
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
        filler_segments_used: fillerUsed.length,
        auto_filler: autoFiller,
        filler_names: [...new Set(fillerUsed.map((s) => s.name).filter(Boolean))],
        traced_length_mi: Number(tracedMi.toFixed(2)),
        seed_length_mi: road.seed_length_mi,
        length_delta_pct: Number(deltaPct.toFixed(1)),
        length_flag: lengthFlag,
        anchor_a: { label: road.anchors[0].label, method: anchors[0].method },
        anchor_b: { label: road.anchors[1].label, method: anchors[1].method },
        note: road.note ?? null,
        source: "Overture Maps transportation/segment release 2026-06-17.0",
        overture_segment_ids: path.used.map((s) => s.id),
      },
      geometry: { type: "LineString", coordinates: path.coords },
    });

    console.log(
      `${road.sweep_id}  ${road.name}\n` +
        `  candidates ${candidates.length} -> used ${path.used.length}` +
        (fillerUsed.length
          ? ` (filler ${fillerUsed.length}: ${[...new Set(fillerUsed.map((s) => s.name ?? "(unnamed)"))].join(", ")})`
          : "") +
        `\n  length ${tracedMi.toFixed(2)} mi vs seed ${road.seed_length_mi} (${deltaPct.toFixed(1)}%)  ${lengthFlag ? "LENGTH OFF >20%" : "ok"}` +
        `\n  anchors: ${anchors.map((a, i) => `${road.anchors[i].label} [${a.method}]`).join(" | ")}\n`
    );
  } catch (err) {
    failures.push({ sweep_id: road.sweep_id, name: road.name, error: err.message });
    console.log(`${road.sweep_id}  ${road.name}\n  FAILED: ${err.message}\n`);
  }
}

const all = [...existing, ...features].sort((a, b) =>
  a.properties.sweep_id.localeCompare(b.properties.sweep_id)
);
writeFileSync(OUT, JSON.stringify({ type: "FeatureCollection", features: all }, null, 2));

console.log(`\nwrote ${OUT}: ${all.length} traced roads (${features.length} this run)`);
if (failures.length > 0) {
  console.log(`FAILURES (${failures.length}):`);
  for (const f of failures) console.log(`  ${f.sweep_id} ${f.name}: ${f.error}`);
}
