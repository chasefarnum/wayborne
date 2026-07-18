// Seed region 01 (Catskills / Hudson Valley) into the hosted Supabase project.
// Repeatable: upserts on regions.number and on (region_id, sweep_id) for
// segments and stops (migration 00002), so re-running updates in place and
// never duplicates or changes row ids.
//
//   node scripts/seed-region-01.mjs
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (never in source; the
// service role bypasses RLS, which curated-content writes need since there
// is no curator auth user yet).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { segments } from "./seed/region-01-segments.mjs";
import { stops } from "./seed/region-01-stops.mjs";
import { stopCoords } from "./seed/region-01-stop-coords.mjs";

const REGION = {
  number: 1,
  slug: "catskills-hudson-valley",
  name: "Catskills / Hudson Valley",
  status: "published",
  is_free: true,
};

// --- env ---------------------------------------------------------------

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

// --- copy guard: no em/en dashes ship, ever -----------------------------

const dashViolations = [];
function scanForDashes(value, path) {
  if (typeof value === "string" && /[–—]/.test(value)) dashViolations.push(path);
  else if (Array.isArray(value)) value.forEach((v, i) => scanForDashes(v, `${path}[${i}]`));
  else if (value && typeof value === "object")
    Object.entries(value).forEach(([k, v]) => scanForDashes(v, `${path}.${k}`));
}
segments.forEach((s) => scanForDashes(s, `segment ${s.sweep_id}`));
stops.forEach((s) => scanForDashes(s, `stop ${s.sweep_id}`));
if (dashViolations.length) {
  console.error("Em/en dashes found in seed copy (workspace rule: they never ship):");
  dashViolations.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}

// --- row shaping ---------------------------------------------------------
// PostgREST bulk upserts require identical keys on every row, so each row is
// padded to the full column set with explicit defaults.

function segmentRow(regionId, s) {
  return {
    region_id: regionId,
    sweep_id: s.sweep_id,
    name: s.name,
    route_desc: s.route_desc,
    endpoints: s.endpoints ?? null,
    length_mi: s.length_mi ?? null,
    sub_area: s.sub_area ?? null,
    character: s.character ?? [],
    blurb: s.blurb ?? null,
    warnings: s.warnings ?? null,
    seasonal_notes: s.seasonal_notes ?? null,
    review_status: s.review_status ?? "keep",
    review_note: s.review_note ?? null,
    provenance: "researched",
    confidence: s.confidence ?? "medium",
    origin: "curated",
    source_urls: s.source_urls ?? [],
  };
}

function stopRow(regionId, s) {
  // Geocoded coordinates (Overture, store-friendly) ride in as EWKT; the
  // geography column parses it. Unmatched stops stay null and off the map.
  const coords = stopCoords[s.sweep_id];
  return {
    region_id: regionId,
    sweep_id: s.sweep_id,
    geom: coords ? `SRID=4326;POINT(${coords.lon} ${coords.lat})` : null,
    name: s.name,
    category: s.category,
    town: s.town ?? null,
    brand: s.brand ?? null,
    blurb: s.blurb ?? null,
    rider_signal: s.rider_signal ?? "none",
    rider_signal_evidence: s.rider_signal_evidence ?? null,
    practicals: s.practicals ?? {},
    seasonal_notes: s.seasonal_notes ?? null,
    status: s.status ?? "open",
    status_note: s.status_note ?? null,
    review_status: s.review_status ?? "keep",
    review_note: s.review_note ?? null,
    provenance: "researched",
    confidence: s.confidence ?? "medium",
    origin: "curated",
    source_urls: s.source_urls ?? [],
  };
}

// --- seed ---------------------------------------------------------------

const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: region, error: regionError } = await db
  .from("regions")
  .upsert(REGION, { onConflict: "number" })
  .select("id, slug")
  .single();
if (regionError) throw new Error(`region upsert failed: ${regionError.message}`);
console.log(`region 01 (${region.slug}): ${region.id}`);

const { error: segError } = await db
  .from("road_segments")
  .upsert(segments.map((s) => segmentRow(region.id, s)), { onConflict: "region_id,sweep_id" });
if (segError) throw new Error(`segment upsert failed: ${segError.message}`);
console.log(`segments upserted: ${segments.length}`);

const { error: stopError } = await db
  .from("stops")
  .upsert(stops.map((s) => stopRow(region.id, s)), { onConflict: "region_id,sweep_id" });
if (stopError) throw new Error(`stop upsert failed: ${stopError.message}`);
console.log(`stops upserted: ${stops.length}`);

// --- verify -------------------------------------------------------------
// Anon (through RLS) must see exactly the kept-and-open subset; the service
// role sees everything. Expectations derive from the data, never hardcoded.

async function count(client, table) {
  const { count: n, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table} failed: ${error.message}`);
  return n;
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });

const expected = {
  segments: { total: segments.length, anon: segments.filter((s) => (s.review_status ?? "keep") === "keep").length },
  stops: {
    total: stops.length,
    anon: stops.filter((s) => (s.review_status ?? "keep") === "keep" && (s.status ?? "open") === "open").length,
  },
};

const results = [
  ["road_segments service", await count(db, "road_segments"), expected.segments.total],
  ["road_segments anon", await count(anon, "road_segments"), expected.segments.anon],
  ["stops service", await count(db, "stops"), expected.stops.total],
  ["stops anon", await count(anon, "stops"), expected.stops.anon],
];

let failed = false;
for (const [label, actual, want] of results) {
  const ok = actual === want;
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${actual} (expected ${want})`);
}
if (failed) {
  console.error("Verification failed: anon visibility does not match the review flags.");
  process.exit(1);
}
console.log("Seed complete; anon sees kept content only.");
