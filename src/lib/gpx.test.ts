import { describe, expect, test } from "vitest";

import {
  DETECHT_POINT_BUDGET,
  SHAPING_POINTS_PER_SEGMENT,
  buildDayGpx,
  gpxFileName,
  lineOf,
  pointOf,
} from "@/lib/gpx";
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
  test("emits the golden GPX 1.1 file for a small mixed day", () => {
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
    expect(result.pointCount).toBe(5);
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
        `    <rtept lat="42.000000" lon="-74.010000">\n` +
        `      <name>NY-214 · start</name>\n` +
        `    </rtept>\n` +
        `    <rtept lat="42.000000" lon="-74.020000">\n` +
        `      <name>NY-214</name>\n` +
        `    </rtept>\n` +
        `    <rtept lat="42.000000" lon="-74.030000">\n` +
        `      <name>NY-214 · end</name>\n` +
        `    </rtept>\n` +
        `    <rtept lat="42.000000" lon="-74.040000">\n` +
        `      <name>Woodland Valley Campground</name>\n` +
        `    </rtept>\n` +
        `  </rte>\n` +
        `</gpx>\n`
    );
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

describe("derivation and orientation", () => {
  test("mixed day emits points in ride order", () => {
    const result = build([
      stop("Diner", [-74.0, 42.0]),
      segment("NY-28A", flatLine(-74.01, -74.05, 5)),
      stop("Camp", [-74.06, 42.0]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    expect(emittedPoints(result.xml).map((p) => p.name)).toEqual([
      "Diner",
      "NY-28A · start",
      "NY-28A",
      "NY-28A · end",
      "Camp",
    ]);
  });

  test("a segment following a stop enters at the nearer endpoint", () => {
    // Trace runs far-to-near: the builder must reverse it so entry sits by
    // the previous stop.
    const result = build([
      stop("Diner", [-74.0, 42.0]),
      segment("NY-28", flatLine(-74.1, -74.005, 5)),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    const points = emittedPoints(result.xml);
    expect(points[1].name).toBe("NY-28 · start");
    expect(points[1].lon).toBeCloseTo(-74.005, 6);
    expect(points[points.length - 1].lon).toBeCloseTo(-74.1, 6);
  });

  test("a day opening with a segment orients toward the next located item", () => {
    // Stop sits by the trace's first coordinate, so the segment reverses to
    // exit toward it.
    const result = build([
      segment("Peekamoose", flatLine(-74.01, -74.1, 5)),
      stop("Camp", [-74.0, 42.0]),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    const points = emittedPoints(result.xml);
    expect(points[0].name).toBe("Peekamoose · start");
    expect(points[0].lon).toBeCloseTo(-74.1, 6);
    expect(points[2].name).toBe("Peekamoose · end");
    expect(points[2].lon).toBeCloseTo(-74.01, 6);
  });

  test("a lone segment keeps its traced direction", () => {
    const result = build([segment("Barkaboom", flatLine(-74.01, -74.1, 5))]);
    if (result.xml == null) throw new Error("expected xml");
    const points = emittedPoints(result.xml);
    expect(points[0].lon).toBeCloseTo(-74.01, 6);
    expect(points[points.length - 1].lon).toBeCloseTo(-74.1, 6);
  });

  test("consecutive segments chain end to start", () => {
    // Second trace supplied reversed; chaining must enter it at the end the
    // first segment exits beside.
    const result = build([
      segment("First", flatLine(-74.0, -74.05, 3)),
      segment("Second", flatLine(-74.15, -74.055, 3)),
    ]);
    if (result.xml == null) throw new Error("expected xml");
    const points = emittedPoints(result.xml);
    const secondStart = points.find((p) => p.name === "Second · start")!;
    expect(secondStart.lon).toBeCloseTo(-74.055, 6);
  });

  test("shaping points sit on traced vertices", () => {
    const line = flatLine(-74.0, -74.1, 11);
    const result = build([segment("NY-30", line)]);
    if (result.xml == null) throw new Error("expected xml");
    const mid = emittedPoints(result.xml).find((p) => p.name === "NY-30")!;
    expect(line.some(([lon]) => Math.abs(lon - mid.lon) < 1e-9)).toBe(true);
  });
});

describe("point budget", () => {
  // 11 segments: essential 22, shaping 11 → 33. Three shortest lose shaping
  // to land exactly on the budget.
  test("shaping collapses shortest-first to fit the budget", () => {
    expect(SHAPING_POINTS_PER_SEGMENT).toBe(1);
    const segments = Array.from({ length: 11 }, (_, i) =>
      // Lengths ascend with i: segment 0 is shortest.
      segment(`Road ${i}`, flatLine(-74.0 - i * 0.2, -74.01 - i * 0.2 - (i + 1) * 0.01, 3))
    );
    const result = build(segments);
    if (result.xml == null) throw new Error("expected xml");
    expect(result.pointCount).toBe(DETECHT_POINT_BUDGET);
    const names = emittedPoints(result.xml).map((p) => p.name);
    // Shortest three collapsed to entry/exit only; longest kept its midpoint.
    for (const i of [0, 1, 2]) expect(names.filter((n) => n === `Road ${i}`).length).toBe(0);
    for (const i of [3, 10]) expect(names.filter((n) => n === `Road ${i}`).length).toBe(1);
  });

  test("essential points are never dropped, even past the budget", () => {
    const segments = Array.from({ length: 20 }, (_, i) =>
      segment(`Road ${i}`, flatLine(-74.0 - i * 0.2, -74.05 - i * 0.2, 3))
    );
    const result = build(segments);
    if (result.xml == null) throw new Error("expected xml");
    // 40 entry/exit points all survive; every shaping point is gone.
    expect(result.pointCount).toBe(40);
    const names = emittedPoints(result.xml).map((p) => p.name);
    expect(names.filter((n) => n.endsWith("· start")).length).toBe(20);
    expect(names.filter((n) => n.endsWith("· end")).length).toBe(20);
    expect(names.filter((n) => !n.includes("·")).length).toBe(0);
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
