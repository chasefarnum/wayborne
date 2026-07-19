import type { CorridorRow } from "@/lib/region-content.client";

// Pure route logic for along-route discovery: polyline decoding, GPX
// parsing, line simplification, and the milepost derivation the list renders
// from. No React, no fetch state; explore components wire this to the UI.

export type LonLat = [number, number];

// Valhalla encodes shapes as polylines with 1e-6 precision (not Google's
// 1e-5); coordinates come out in GeoJSON [lon, lat] order.
export function decodePolyline6(encoded: string): LonLat[] {
  const coords: LonLat[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  while (index < encoded.length) {
    for (const which of [0, 1] as const) {
      let result = 0;
      let shift = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lon += delta;
    }
    coords.push([lon / 1e6, lat / 1e6]);
  }
  return coords;
}

const EARTH_RADIUS_MI = 3958.8;

function haversineMi(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function lineLengthMi(coords: LonLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += haversineMi(coords[i - 1], coords[i]);
  return total;
}

// --- Stadia Valhalla routing (client-side) ---------------------------------

// Dev is keyless: Stadia's localhost exemption covers the routing API
// (verified 2026-07-18, openspec change dir). Production needs the key.
const STADIA_ROUTE_URL = "https://api.stadiamaps.com/route/v1";

export async function fetchRoutedLine(
  start: LonLat,
  end: LonLat
): Promise<{ line: GeoJSON.LineString; lengthMi: number }> {
  const key = process.env.NEXT_PUBLIC_STADIA_API_KEY;
  const res = await fetch(`${STADIA_ROUTE_URL}${key ? `?api_key=${key}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locations: [
        { lat: start[1], lon: start[0] },
        { lat: end[1], lon: end[0] },
      ],
      costing: "auto",
      units: "miles",
    }),
  });
  if (!res.ok) throw new Error(`Routing failed: ${res.status}`);
  const data = (await res.json()) as {
    trip: { legs: { shape: string }[]; summary: { length: number } };
  };
  const coordinates: LonLat[] = [];
  for (const leg of data.trip.legs) {
    const decoded = decodePolyline6(leg.shape);
    // Legs share their joint point; skip the duplicate on continuation legs.
    coordinates.push(...(coordinates.length > 0 ? decoded.slice(1) : decoded));
  }
  if (coordinates.length < 2) throw new Error("Routing returned no line");
  return {
    line: { type: "LineString", coordinates },
    lengthMi: data.trip.summary.length,
  };
}

// --- GPX -------------------------------------------------------------------

// Tolerant attribute-tag scan instead of DOMParser: identical behavior in the
// browser and in node unit tests with no new dependency (design.md amendment,
// 2026-07-18). GPX points are attribute-based (<trkpt lat=".." lon="..">), so
// tag scanning is reliable; a file yielding no readable points lands in the
// unreadable state exactly as a parse failure would.
function extractPoints(xml: string, tag: "trkpt" | "rtept"): LonLat[] {
  const points: LonLat[] = [];
  const tagPattern = new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}\\b([^>]*)>`, "g");
  const latPattern = /\blat\s*=\s*["']([^"']+)["']/;
  const lonPattern = /\blon\s*=\s*["']([^"']+)["']/;
  for (const match of xml.matchAll(tagPattern)) {
    const attrs = match[1];
    const lat = Number(latPattern.exec(attrs)?.[1]);
    const lon = Number(lonPattern.exec(attrs)?.[1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push([lon, lat]);
  }
  return points;
}

// Tracks win over routes when a file carries both (a track is the ridden
// line). Returns null when no readable line exists; the caller owns the
// unreadable state. No partial or guessed line: fewer than two points is null.
export function parseGpx(xml: string): GeoJSON.LineString | null {
  const track = extractPoints(xml, "trkpt");
  const coordinates = track.length >= 2 ? track : extractPoints(xml, "rtept");
  if (coordinates.length < 2) return null;
  return { type: "LineString", coordinates };
}

// --- Simplification --------------------------------------------------------

export const MAX_LINE_POINTS = 500;

function perpendicularDistanceSq(p: LonLat, a: LonLat, b: LonLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  const px = a[0] + t * dx;
  const py = a[1] + t * dy;
  return (p[0] - px) ** 2 + (p[1] - py) ** 2;
}

function douglasPeucker(coords: LonLat[], toleranceSq: number): LonLat[] {
  if (coords.length <= 2) return coords;
  // Iterative stack form; 9k-point tracks would recurse deep otherwise.
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = keep[coords.length - 1] = true;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistSq = 0;
    let maxIndex = 0;
    for (let i = first + 1; i < last; i++) {
      const distSq = perpendicularDistanceSq(coords[i], coords[first], coords[last]);
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
        maxIndex = i;
      }
    }
    if (maxDistSq > toleranceSq) {
      keep[maxIndex] = true;
      stack.push([first, maxIndex], [maxIndex, last]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

// Douglas-Peucker with a doubling tolerance until the line fits maxPoints.
// Start tolerance ~11 m in degree space: invisible at corridor scale.
export function simplifyLine(
  line: GeoJSON.LineString,
  maxPoints: number = MAX_LINE_POINTS
): GeoJSON.LineString {
  let coords = line.coordinates as LonLat[];
  if (coords.length <= maxPoints) return line;
  let tolerance = 1e-4;
  for (let i = 0; i < 24 && coords.length > maxPoints; i++) {
    coords = douglasPeucker(line.coordinates as LonLat[], tolerance * tolerance);
    tolerance *= 2;
  }
  return { type: "LineString", coordinates: coords };
}

// --- Milepost derivation (the list is derived, not stored) -----------------

export type OrderedRow = {
  row: CorridorRow;
  // Rounded milepost from along_pos x line length; the label reads "mi N".
  mi: number;
};

// Sort by position along the line; a loop passing an item twice keeps its
// first approach (minimum along_pos). The RPC already returns one row per
// item, so the dedupe is a guard, not a workhorse.
export function orderRows(rows: CorridorRow[], lengthMi: number): OrderedRow[] {
  const firstApproach = new Map<string, CorridorRow>();
  for (const row of rows) {
    const seen = firstApproach.get(row.id);
    if (!seen || row.along_pos < seen.along_pos) firstApproach.set(row.id, row);
  }
  return [...firstApproach.values()]
    .sort((a, b) => a.along_pos - b.along_pos || a.off_line_m - b.off_line_m)
    .map((row) => ({ row, mi: Math.round(row.along_pos * lengthMi) }));
}

// Gap wide enough to narrate as a quiet stretch (design decision 5).
export const QUIET_GAP_MI = 15;
// Line continuing this far past the last content is a coverage exit
// (design decision 6: envelope heuristic, no region polygon exists).
export const EXIT_CONTINUE_MI = 10;

export type CorridorNote =
  | { kind: "quiet"; fromMi: number; toMi: number; afterIndex: number }
  | { kind: "exit"; atMi: number; afterIndex: number };

// Notes derive from the full (unfiltered) corridor: with a chip active the
// list is explicitly filtered, so gap narration would lie and stays off.
// Quiet stretches are internal gaps between consecutive results; the exit
// note is the envelope end. Inside the envelope the quiet note wins.
export function corridorNotes(ordered: OrderedRow[], lengthMi: number): CorridorNote[] {
  const notes: CorridorNote[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1].mi;
    const to = ordered[i].mi;
    if (to - from > QUIET_GAP_MI) {
      notes.push({ kind: "quiet", fromMi: from, toMi: to, afterIndex: i - 1 });
    }
  }
  if (ordered.length > 0) {
    const lastMi = ordered[ordered.length - 1].mi;
    if (lengthMi - lastMi > EXIT_CONTINUE_MI) {
      notes.push({ kind: "exit", atMi: lastMi, afterIndex: ordered.length - 1 });
    }
  }
  return notes;
}

export function quietNoteText(note: { fromMi: number; toMi: number }): string {
  return `Quiet stretch. Nothing curated within 5 mi of this part of your line; it picks back up at mi ${note.toMi}.`;
}

export function exitNoteText(note: { atMi: number }, regionName: string): string {
  return `Your line leaves the ${regionName} curation at mi ${note.atMi}. The road keeps going; our vetted layer ends here, for now.`;
}

// Off-line distance is the only distance: straight-line, honest, never a
// detour time. Under a tenth of a mile reads as on the line.
export function offLineLabel(offLineM: number): string {
  const mi = offLineM / 1609.344;
  return mi < 0.1 ? "on your line" : `~${mi.toFixed(1)} mi off your line`;
}

// --- Intent chips (route mode) ---------------------------------------------

// Intent-level filters, not taxonomy (gate verdict 4): none active by
// default; active chips OR together and filter list and map as one. Dealers
// and service carry no chip in v1 and show only in the unfiltered corridor
// (full taxonomy stays in catalog mode; "More filters" was cut).
export const INTENT_CHIPS: {
  value: string;
  label: string;
  categories: string[];
  segments: boolean;
}[] = [
  {
    value: "camping",
    label: "Camping tonight",
    categories: ["dec_campground", "private_campground"],
    segments: false,
  },
  {
    value: "food",
    label: "Food & towns",
    categories: [
      "diner",
      "bbq",
      "roadhouse",
      "ice_cream",
      "farm_stand",
      "general_store",
      "hangout",
      "dive_bar",
    ],
    segments: false,
  },
  { value: "overlooks", label: "Overlooks", categories: ["overlook", "poi"], segments: false },
  { value: "roads", label: "Twisty roads", categories: [], segments: true },
];

export function rowMatchesIntent(row: CorridorRow, active: string[]): boolean {
  if (active.length === 0) return true;
  return INTENT_CHIPS.some((chip) => {
    if (!active.includes(chip.value)) return false;
    if (row.item_type === "segment") return chip.segments;
    return chip.categories.includes(row.category);
  });
}
