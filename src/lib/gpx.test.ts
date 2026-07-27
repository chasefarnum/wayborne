import { describe, expect, test } from "vitest";

import { buildDayGpx, gpxFileName, lineOf, midpointOf, pointOf } from "@/lib/gpx";
import type { GpxDayItem } from "@/lib/gpx";
import type { LonLat } from "@/lib/route";

// Extract the emitted points back out of the xml with the same tolerant
// tag-scan philosophy the parser uses; assertions read like the route list.
function emittedPoints(xml: string): { lat: number; lon: number; name: string }[] {
  return [...xml.matchAll(/<rtept lat="([^"]+)" lon="([^"]+)">\s*<name>([^<]*)<\/name>/g)].map(
    (m) => ({ lat: Number(m[1]), lon: Number(m[2]), name: m[3] })
  );
}

const stop = (name: string, at: LonLat | null): GpxDayItem => ({ kind: "stop", name, at });
const segment = (name: string, line: LonLat[] | null): GpxDayItem => ({
  kind: "segment",
  name,
  line,
});

// Straight west-running line at 42N; ~0.01 lon ≈ 0.51 mi, plenty distinct.
const flatLine = (fromLon: number, toLon: number, points: number): LonLat[] =>
  Array.from({ length: points }, (_, i) => [
    fromLon + ((toLon - fromLon) * i) / (points - 1),
    42,
  ]);

const build = (items: GpxDayItem[], dayNumber = 1, dayCount = 1) =>
  buildDayGpx({ regionName: "Catskills / Hudson Valley", dayNumber, dayCount, items });

describe("file structure", () => {
  test("emits the golden route-only file for a small mixed day", () => {
    const result = build(
      [
        stop("Phoenicia Diner", [-74.0, 42.0]),
        segment("NY-214", flatLine(-74.01, -74.03, 3)),
        stop("Woodland Valley Campground", [-74.04, 42.0]),
      ],
      2,
      3
    );
    if (result.xml == null) throw new Error("expected xml");
    expect(result.pointCount).toBe(3);
    expect(result.excluded).toEqual([]);
    expect(result.xml).toBe(
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<gpx version="1.1" creator="Wayborne" xmlns="http://www.topografix.com/GPX/1/1">\n` +
        `  <metadata>\n` +
        `    <name>Wayborne · Catskills / Hudson Valley · Day 2 of 3</name>\n` +
        `  </metadata>\n` +
        `  <rte>\n` +
        `    <name>Wayborne · Catskills / Hudson Valley · Day 2 of 3</name>\n` +
        `    <rtept lat="42.000000" lon="-74.000000">\n` +
        `      <name>Phoenicia Diner</name>\n` +
        `    </rtept>\n` +
        `    <rtept lat="42.000000" lon="-74.020000">\n` +
        `      <name>NY-214</name>\n` +
        `    </rtept>\n` +
        `    <rtept lat="42.000000" lon="-74.040000">\n` +
        `      <name>Woodland Valley Campground</name>\n` +
        `    </rtept>\n` +
        `  </rte>\n` +
        `</gpx>\n`
    );
  });

  test("the file carries exactly one route and no track", () => {
    // Detecht's app reads both carriers from a dual rte+trk file and doubles
    // every stop; the file stays route-only by design.
    const result = build([
      stop("Diner", [-74.0, 42.0]),
      segment("NY-28A", flatLine(-74.01, -74.05, 5)),
      stop("Camp", [-74.06, 42.0]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    expect(result.xml.match(/<rte>/g)).toHaveLength(1);
    expect(result.xml).not.toContain("<trk>");
    expect(result.xml).not.toContain("<trkpt");
  });

  test("escapes XML-hostile characters in names", () => {
    const result = build([
      stop(`Hickory BBQ & Smokehouse <"south">`, [-74.0, 42.0]),
      stop("Snyder's Tavern", [-74.01, 42.0]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    expect(result.xml).toContain("Hickory BBQ &amp; Smokehouse &lt;&quot;south&quot;&gt;");
    expect(result.xml).toContain("Snyder&apos;s Tavern");
    expect(result.xml).not.toMatch(/& /);
  });

  test("coordinates emit at 6 decimal places", () => {
    const result = build([
      stop("A", [-74.123456789, 42.987654321]),
      stop("B", [-74.2, 42.1]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    expect(result.xml).toContain(`lat="42.987654" lon="-74.123457"`);
    expect(result.xml).toContain(`lat="42.100000" lon="-74.200000"`);
  });

  test("file name carries region slug and day number", () => {
    expect(gpxFileName("catskills-hudson-valley", 2)).toBe(
      "wayborne-catskills-hudson-valley-day-2.gpx"
    );
  });
});

describe("point derivation — locations only", () => {
  test("one named point per item, in ride order", () => {
    const result = build([
      stop("Diner", [-74.0, 42.0]),
      segment("NY-28A", flatLine(-74.01, -74.05, 5)),
      segment("Peekamoose", flatLine(-74.06, -74.1, 5)),
      stop("Camp", [-74.11, 42.0]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    expect(emittedPoints(result.xml).map((p) => p.name)).toEqual([
      "Diner",
      "NY-28A",
      "Peekamoose",
      "Camp",
    ]);
    expect(result.pointCount).toBe(4);
  });

  test("a road's point sits at its arc-length midpoint, on a traced vertex", () => {
    const line = flatLine(-74.0, -74.1, 11);
    const result = build([stop("Diner", [-73.99, 42.0]), segment("NY-30", line)]);
    if (result.xml == null) throw new Error("expected xml");
    const road = emittedPoints(result.xml).find((p) => p.name === "NY-30")!;
    expect(road.lon).toBeCloseTo(-74.05, 6);
    expect(line.some(([lon]) => Math.abs(lon - road.lon) < 1e-9)).toBe(true);
  });

  test("midpointOf picks the vertex nearest half the arc length on uneven spacing", () => {
    // Vertices bunched at the west end: the halfway vertex by arc length is
    // not the middle by index.
    const line: LonLat[] = [
      [-74.0, 42],
      [-74.4, 42],
      [-74.5, 42],
      [-74.52, 42],
      [-74.54, 42],
    ];
    expect(midpointOf(line)).toEqual([-74.4, 42]);
  });
});

describe("exclusions and empty days", () => {
  test("items without geometry are excluded with reasons", () => {
    const result = build([
      stop("Diner", [-74.0, 42.0]),
      segment("Dennytown Road", null),
      stop("Kaaterskill Falls platform", null),
      stop("Camp", [-74.02, 42.0]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    expect(result.excluded).toEqual([
      { name: "Dennytown Road", reason: "no traced geometry yet" },
      { name: "Kaaterskill Falls platform", reason: "no pin yet" },
    ]);
    expect(result.xml).not.toContain("Dennytown");
    expect(result.xml).not.toContain("Kaaterskill");
    expect(result.pointCount).toBe(2);
  });

  test("a day with nothing located has no exportable line", () => {
    const result = build([segment("Dennytown Road", null), stop("Platform", null)]);
    expect(result.xml).toBeNull();
    if (result.xml != null) throw new Error("unreachable");
    expect(result.reason).toBe("Nothing on this day has geometry to export yet.");
    expect(result.excluded.length).toBe(2);
  });

  test("a single located stop is not a line", () => {
    const result = build([stop("Diner", [-74.0, 42.0])]);
    expect(result.xml).toBeNull();
    if (result.xml != null) throw new Error("unreachable");
    expect(result.reason).toBe("A route needs at least two located points.");
  });

  test("an empty day has no exportable line", () => {
    const result = build([]);
    expect(result.xml).toBeNull();
  });
});

describe("geometry guards", () => {
  test("lineOf accepts a LineString and rejects everything else", () => {
    expect(lineOf({ type: "LineString", coordinates: flatLine(-74, -74.1, 3) })).toHaveLength(3);
    expect(lineOf({ type: "LineString", coordinates: [[-74, 42]] })).toBeNull();
    expect(lineOf({ type: "Point", coordinates: [-74, 42] })).toBeNull();
    expect(lineOf("0102000020E6100000")).toBeNull();
    expect(lineOf(null)).toBeNull();
  });

  test("pointOf accepts a Point and rejects everything else", () => {
    expect(pointOf({ type: "Point", coordinates: [-74, 42] })).toEqual([-74, 42]);
    expect(pointOf({ type: "LineString", coordinates: flatLine(-74, -74.1, 3) })).toBeNull();
    expect(pointOf(null)).toBeNull();
  });
});
