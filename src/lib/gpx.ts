import { lineLengthMi, type LonLat } from "@/lib/route";

// Per-day GPX 1.1 route export (gpx-export design.md). Points are intent,
// not shape: Detecht re-routes between rtepts with its own engine, and every
// exported point is rider-visible and skippable, so the file carries the
// minimum set of named points that pins their router to the curated roads.
// Pure string assembly, no React, no XML serializer dependency — the mirror
// of the parse-side tolerant tag scan.

export type GpxDayItem =
  | { kind: "segment"; name: string; line: LonLat[] | null }
  | { kind: "stop"; name: string; at: LonLat | null };

export type GpxExcluded = { name: string; reason: string };

export type GpxBuildResult =
  | { xml: string; pointCount: number; excluded: GpxExcluded[] }
  | { xml: null; reason: string; excluded: GpxExcluded[] };

// One interior point per segment to start; tuned by the Detecht field test
// (tasks.md 4.1), never a schema property.
export const SHAPING_POINTS_PER_SEGMENT = 1;

// Detecht's importer takes up to 240 waypoints but recommends staying under
// 30 and decimates above it (research: detecht-gpx-import-notes.md). Shaping
// collapses to fit; essential points never drop — an oversized day exports in
// full and the count is the rider's signal, not ours to rewrite.
export const DETECHT_POINT_BUDGET = 30;

// Geometry guards for the computed geojson columns (served as plain json;
// untraced segments and ungeocoded stops arrive null).
export function lineOf(geom: unknown): LonLat[] | null {
  if (
    geom &&
    typeof geom === "object" &&
    (geom as { type?: unknown }).type === "LineString" &&
    Array.isArray((geom as { coordinates?: unknown }).coordinates)
  ) {
    const coords = (geom as { coordinates: unknown[] }).coordinates as LonLat[];
    return coords.length >= 2 ? coords : null;
  }
  return null;
}

export function pointOf(geom: unknown): LonLat | null {
  if (
    geom &&
    typeof geom === "object" &&
    (geom as { type?: unknown }).type === "Point" &&
    Array.isArray((geom as { coordinates?: unknown }).coordinates)
  ) {
    return (geom as { coordinates: LonLat }).coordinates;
  }
  return null;
}

const distMi = (a: LonLat, b: LonLat) => lineLengthMi([a, b]);

type RoutePoint = { at: LonLat; name: string; shaping: boolean };

// Shaping points snap to existing traced vertices (nearest by arc length to
// the even split), never interpolated: an invented coordinate can sit off the
// road, and an off-road rtept is exactly the router bait this file exists to
// avoid.
function shapingIndices(line: LonLat[], count: number): number[] {
  if (count <= 0 || line.length <= 2) return [];
  const cumulative: number[] = [0];
  for (let i = 1; i < line.length; i++) {
    cumulative.push(cumulative[i - 1] + distMi(line[i - 1], line[i]));
  }
  const total = cumulative[cumulative.length - 1];
  if (total === 0) return [];
  const indices: number[] = [];
  for (let k = 1; k <= count; k++) {
    const target = (total * k) / (count + 1);
    let best = 1;
    for (let i = 1; i < line.length - 1; i++) {
      if (Math.abs(cumulative[i] - target) < Math.abs(cumulative[best] - target)) best = i;
    }
    if (!indices.includes(best)) indices.push(best);
  }
  return indices;
}

// Nearest-endpoint chaining (design.md Decision 3): a segment enters at
// whichever end of its trace is closer to the moving anchor. A day opening
// with a segment orients against the next located item; with nothing else
// located, the traced direction stands.
function orientLine(line: LonLat[], anchor: LonLat | null, ahead: LonLat | null): LonLat[] {
  const start = line[0];
  const end = line[line.length - 1];
  if (anchor) {
    return distMi(anchor, start) <= distMi(anchor, end) ? line : [...line].reverse();
  }
  if (ahead) {
    return distMi(ahead, end) <= distMi(ahead, start) ? line : [...line].reverse();
  }
  return line;
}

function firstLocatedCoord(items: GpxDayItem[]): LonLat | null {
  for (const item of items) {
    if (item.kind === "stop" && item.at) return item.at;
    if (item.kind === "segment" && item.line) return item.line[0];
  }
  return null;
}

function xmlEscape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const coord = (n: number) => n.toFixed(6);

export function gpxFileName(regionSlug: string, dayNumber: number): string {
  return `wayborne-${regionSlug}-day-${dayNumber}.gpx`;
}

export function buildDayGpx({
  regionName,
  dayNumber,
  dayCount,
  items,
}: {
  regionName: string;
  dayNumber: number;
  dayCount: number;
  items: GpxDayItem[];
}): GpxBuildResult {
  const excluded: GpxExcluded[] = [];
  const located = items.filter((item) => {
    if (item.kind === "segment" && !item.line) {
      excluded.push({ name: item.name, reason: "no traced geometry yet" });
      return false;
    }
    if (item.kind === "stop" && !item.at) {
      excluded.push({ name: item.name, reason: "no pin yet" });
      return false;
    }
    return true;
  });

  // Derive points in ride order, carrying the anchor through so each segment
  // is ridden continuously in the day's direction of travel.
  type SegmentPoints = { entry: RoutePoint; shaping: RoutePoint[]; exit: RoutePoint; miles: number };
  const sequence: (RoutePoint | SegmentPoints)[] = [];
  let anchor: LonLat | null = null;
  located.forEach((item, i) => {
    if (item.kind === "stop") {
      sequence.push({ at: item.at!, name: item.name, shaping: false });
      anchor = item.at!;
      return;
    }
    const ahead = anchor ? null : firstLocatedCoord(located.slice(i + 1));
    const line = orientLine(item.line!, anchor, ahead);
    sequence.push({
      entry: { at: line[0], name: `${item.name} · start`, shaping: false },
      shaping: shapingIndices(line, SHAPING_POINTS_PER_SEGMENT).map((idx) => ({
        at: line[idx],
        name: item.name,
        shaping: true,
      })),
      exit: { at: line[line.length - 1], name: `${item.name} · end`, shaping: false },
      miles: lineLengthMi(line),
    });
    anchor = line[line.length - 1];
  });

  // Budget: shaping collapses shortest-segment-first until the file fits;
  // stop and entry/exit points are never dropped (design.md Decision 4).
  const segments = sequence.filter((s): s is SegmentPoints => "entry" in s);
  const essential = sequence.length + segments.length; // stops + entry/exit per segment
  let shapingTotal = segments.reduce((sum, s) => sum + s.shaping.length, 0);
  if (essential + shapingTotal > DETECHT_POINT_BUDGET) {
    for (const s of [...segments].sort((a, b) => a.miles - b.miles)) {
      if (essential + shapingTotal <= DETECHT_POINT_BUDGET) break;
      shapingTotal -= s.shaping.length;
      s.shaping = [];
    }
  }

  const points: RoutePoint[] = sequence.flatMap((s) =>
    "entry" in s ? [s.entry, ...s.shaping, s.exit] : [s]
  );

  if (points.length < 2) {
    return {
      xml: null,
      reason:
        located.length === 0
          ? "Nothing on this day has geometry to export yet."
          : "A route needs at least two located points.",
      excluded,
    };
  }

  const routeName = `Wayborne · ${regionName} · Day ${dayNumber} of ${dayCount}`;
  const rtepts = points
    .map(
      (p) =>
        `    <rtept lat="${coord(p.at[1])}" lon="${coord(p.at[0])}">\n` +
        `      <name>${xmlEscape(p.name)}</name>\n` +
        `    </rtept>`
    )
    .join("\n");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Wayborne" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n    <name>${xmlEscape(routeName)}</name>\n  </metadata>\n` +
    `  <rte>\n    <name>${xmlEscape(routeName)}</name>\n${rtepts}\n  </rte>\n` +
    `</gpx>\n`;

  return { xml, pointCount: points.length, excluded };
}
