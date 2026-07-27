import { lineLengthMi, type LonLat } from "@/lib/route";

// Per-day GPX 1.1 export (gpx-export design.md). Waypoints are locations,
// not shape: one named point per stop, one per curated road (its arc-length
// midpoint), and the nav app's router owns the line between them. Chase's
// call, field-tested against Detecht's web planner 2026-07-26: multi-point
// roads reverse-geocode into a wall of duplicate street names there, and
// every exported point is rider-visible, so filler is UX damage. Pure string
// assembly, no React, no XML serializer dependency — the mirror of the
// parse-side tolerant tag scan.

export type GpxDayItem =
  | { kind: "segment"; name: string; line: LonLat[] | null }
  | { kind: "stop"; name: string; at: LonLat | null };

export type GpxExcluded = { name: string; reason: string };

export type GpxBuildResult =
  | { xml: string; pointCount: number; excluded: GpxExcluded[] }
  | { xml: null; reason: string; excluded: GpxExcluded[] };

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

// A road's one waypoint snaps to the traced vertex nearest the arc-length
// midpoint, never interpolated: an invented coordinate can sit off the road,
// and an off-road waypoint is exactly the router bait this file exists to
// avoid.
export function midpointOf(line: LonLat[]): LonLat {
  const cumulative: number[] = [0];
  for (let i = 1; i < line.length; i++) {
    cumulative.push(cumulative[i - 1] + lineLengthMi([line[i - 1], line[i]]));
  }
  const target = cumulative[cumulative.length - 1] / 2;
  let best = 0;
  for (let i = 1; i < line.length; i++) {
    if (Math.abs(cumulative[i] - target) < Math.abs(cumulative[best] - target)) best = i;
  }
  return line[best];
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
  const points: { at: LonLat; name: string }[] = [];
  for (const item of items) {
    if (item.kind === "segment") {
      if (item.line) points.push({ at: midpointOf(item.line), name: item.name });
      else excluded.push({ name: item.name, reason: "no traced geometry yet" });
    } else {
      if (item.at) points.push({ at: item.at, name: item.name });
      else excluded.push({ name: item.name, reason: "no pin yet" });
    }
  }

  if (points.length < 2) {
    return {
      xml: null,
      reason:
        points.length === 0
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
  // Route only, no mirror track: Detecht's phone app — the delivery path —
  // reads BOTH carriers from a dual file and doubles every stop (field-tested
  // 2026-07-26). Their web planner errors on route-only files, but it
  // resamples the line and discards locations even when it accepts one, so
  // it was never a way to deliver the plan.
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Wayborne" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n    <name>${xmlEscape(routeName)}</name>\n  </metadata>\n` +
    `  <rte>\n    <name>${xmlEscape(routeName)}</name>\n${rtepts}\n  </rte>\n` +
    `</gpx>\n`;

  return { xml, pointCount: points.length, excluded };
}
