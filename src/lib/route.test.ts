import { describe, expect, test } from "vitest";

import type { CorridorRow } from "@/lib/region-content.client";
import {
  MAX_LINE_POINTS,
  corridorNotes,
  decodePolyline6,
  exitNoteText,
  lineLengthMi,
  offLineLabel,
  orderRows,
  parseGpx,
  quietNoteText,
  rowMatchesIntent,
  simplifyLine,
} from "@/lib/route";
import type { LonLat } from "@/lib/route";

// Reference encoder for round-trip checks: the inverse of decodePolyline6,
// same 1e-6 precision Valhalla uses.
function encodePolyline6(coords: LonLat[]): string {
  let out = "";
  let prevLat = 0;
  let prevLon = 0;
  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let chunk = "";
    while (v >= 0x20) {
      chunk += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return chunk + String.fromCharCode(v + 63);
  };
  for (const [lon, lat] of coords) {
    const latE6 = Math.round(lat * 1e6);
    const lonE6 = Math.round(lon * 1e6);
    out += encodeValue(latE6 - prevLat) + encodeValue(lonE6 - prevLon);
    prevLat = latE6;
    prevLon = lonE6;
  }
  return out;
}

describe("polyline decoding", () => {
  test("round-trips coordinates at 1e-6 precision", () => {
    const coords: LonLat[] = [
      [-73.9974, 41.927],
      [-74.3171, 42.0854],
      [-74.9116, 41.9331],
    ];
    const decoded = decodePolyline6(encodePolyline6(coords));
    expect(decoded).toHaveLength(3);
    decoded.forEach(([lon, lat], i) => {
      expect(lon).toBeCloseTo(coords[i][0], 6);
      expect(lat).toBeCloseTo(coords[i][1], 6);
    });
  });
});

describe("line length", () => {
  test("one degree of longitude at 42N is about 51.4 miles", () => {
    const length = lineLengthMi([
      [-74, 42],
      [-73, 42],
    ]);
    expect(length).toBeGreaterThan(50);
    expect(length).toBeLessThan(53);
  });
});

describe("GPX parsing", () => {
  const gpxTrack = `<?xml version="1.0"?>
    <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">
      <trk><name>Day 2</name><trkseg>
        <trkpt lat="41.927" lon="-73.9974"><ele>62</ele></trkpt>
        <trkpt lat="42.0" lon="-74.1"/>
        <trkpt lon="-74.3171" lat="42.0854"></trkpt>
      </trkseg></trk>
    </gpx>`;

  test("reads a track with mixed attribute order and self-closing points", () => {
    const line = parseGpx(gpxTrack);
    expect(line).not.toBeNull();
    expect(line!.coordinates).toEqual([
      [-73.9974, 41.927],
      [-74.1, 42.0],
      [-74.3171, 42.0854],
    ]);
  });

  test("falls back to a route when no track exists", () => {
    const gpxRoute = `<gpx><rte>
      <rtept lat="41.9" lon="-74.0"/>
      <rtept lat="42.0" lon="-74.2"/>
    </rte></gpx>`;
    expect(parseGpx(gpxRoute)!.coordinates).toHaveLength(2);
  });

  test("prefers the track when both exist", () => {
    const both = `<gpx>
      <rte><rtept lat="0" lon="0"/><rtept lat="1" lon="1"/></rte>
      <trk><trkseg><trkpt lat="41.9" lon="-74.0"/><trkpt lat="42.0" lon="-74.2"/></trkseg></trk>
    </gpx>`;
    expect(parseGpx(both)!.coordinates[0]).toEqual([-74.0, 41.9]);
  });

  test("handles namespace-prefixed tags", () => {
    const prefixed = `<g:gpx xmlns:g="http://www.topografix.com/GPX/1/1">
      <g:trk><g:trkseg>
        <g:trkpt lat="41.9" lon="-74.0"/><g:trkpt lat="42.0" lon="-74.2"/>
      </g:trkseg></g:trk></g:gpx>`;
    expect(parseGpx(prefixed)!.coordinates).toHaveLength(2);
  });

  test("a file with no readable points is null, never a partial line", () => {
    expect(parseGpx("not xml at all")).toBeNull();
    expect(parseGpx("<gpx><wpt lat='41' lon='-74'/></gpx>")).toBeNull();
    expect(parseGpx(`<gpx><trk><trkseg><trkpt lat="41.9" lon="-74.0"/></trkseg></trk></gpx>`)).toBeNull();
    expect(parseGpx(`<gpx><trkpt lat="x" lon="y"/><trkpt lat="1" lon="2"/></gpx>`)).toBeNull();
  });
});

describe("line simplification", () => {
  test("a 9,000-point track simplifies under the cap with endpoints intact", () => {
    const coords: LonLat[] = Array.from({ length: 9000 }, (_, i) => [
      -74.9 + (i / 9000) * 1.0,
      42.0 + 0.05 * Math.sin(i / 40),
    ]);
    const simplified = simplifyLine({ type: "LineString", coordinates: coords });
    expect(simplified.coordinates.length).toBeLessThanOrEqual(MAX_LINE_POINTS);
    expect(simplified.coordinates.length).toBeGreaterThan(2);
    expect(simplified.coordinates[0]).toEqual(coords[0]);
    expect(simplified.coordinates.at(-1)).toEqual(coords.at(-1));
  });

  test("a short line passes through untouched", () => {
    const line: GeoJSON.LineString = {
      type: "LineString",
      coordinates: [
        [-74, 42],
        [-74.5, 42.2],
      ],
    };
    expect(simplifyLine(line)).toBe(line);
  });
});

const stopRow = (overrides: Partial<CorridorRow> = {}): CorridorRow =>
  ({
    item_type: "stop",
    id: crypto.randomUUID(),
    sweep_id: "s-001",
    name: "Phoenicia Diner",
    category: "diner",
    town: "Phoenicia",
    blurb: null,
    rider_signal: "none",
    practicals: {},
    seasonal_notes: null,
    provenance: "researched",
    source_urls: [],
    geom: { type: "Point", coordinates: [-74.3, 42.08] },
    off_line_m: 500,
    along_pos: 0.5,
    ...overrides,
  }) as CorridorRow;

describe("milepost ordering", () => {
  test("rows sort by position along the line with rounded mi labels", () => {
    const rows = [
      stopRow({ along_pos: 0.9 }),
      stopRow({ along_pos: 0.153 }),
      stopRow({ along_pos: 0.4 }),
    ];
    const ordered = orderRows(rows, 78);
    expect(ordered.map((r) => r.row.along_pos)).toEqual([0.153, 0.4, 0.9]);
    expect(ordered.map((r) => r.mi)).toEqual([12, 31, 70]);
  });

  test("a loop passing an item twice keeps first approach only", () => {
    const id = crypto.randomUUID();
    const rows = [
      stopRow({ id, along_pos: 0.8, off_line_m: 200 }),
      stopRow({ id, along_pos: 0.2, off_line_m: 900 }),
      stopRow({ along_pos: 0.5 }),
    ];
    const ordered = orderRows(rows, 100);
    expect(ordered).toHaveLength(2);
    expect(ordered[0].row.id).toBe(id);
    expect(ordered[0].mi).toBe(20);
  });

  test("ties on position fall back to off-line distance", () => {
    const near = stopRow({ along_pos: 0.5, off_line_m: 100 });
    const far = stopRow({ along_pos: 0.5, off_line_m: 4000 });
    const ordered = orderRows([far, near], 50);
    expect(ordered[0].row).toBe(near);
  });
});

describe("corridor notes", () => {
  const orderedAt = (mileposts: number[], lengthMi: number) =>
    orderRows(
      mileposts.map((mi) => stopRow({ along_pos: mi / lengthMi })),
      lengthMi
    );

  test("an internal gap over the threshold narrates as a quiet stretch", () => {
    const notes = corridorNotes(orderedAt([12, 26, 58, 61], 65), 65);
    expect(notes).toEqual([{ kind: "quiet", fromMi: 26, toMi: 58, afterIndex: 1 }]);
  });

  test("close-set results produce no notes", () => {
    expect(corridorNotes(orderedAt([5, 15, 25, 35], 40), 40)).toEqual([]);
  });

  test("the line continuing past the last content is a coverage exit", () => {
    const notes = corridorNotes(orderedAt([45, 55, 61], 78), 78);
    expect(notes).toEqual([{ kind: "exit", atMi: 61, afterIndex: 2 }]);
  });

  test("a quiet stretch and a coverage exit can coexist, worded apart", () => {
    const notes = corridorNotes(orderedAt([12, 55, 61], 90), 90);
    expect(notes).toHaveLength(2);
    expect(notes[0].kind).toBe("quiet");
    expect(notes[1].kind).toBe("exit");
    const quiet = quietNoteText({ fromMi: 12, toMi: 55 });
    const exit = exitNoteText({ atMi: 61 }, "Catskills / Hudson Valley");
    expect(quiet).not.toBe(exit);
    expect(quiet).toContain("picks back up at mi 55");
    expect(exit).toContain("leaves the Catskills / Hudson Valley curation at mi 61");
  });

  test("content near the end of the line produces no exit note", () => {
    expect(corridorNotes(orderedAt([50, 60], 65), 65)).toEqual([]);
  });

  test("an empty corridor produces no notes", () => {
    expect(corridorNotes([], 65)).toEqual([]);
  });
});

describe("off-line labels", () => {
  test("distances read as honest straight-line miles", () => {
    expect(offLineLabel(3380)).toBe("~2.1 mi off your line");
    expect(offLineLabel(1609.344)).toBe("~1.0 mi off your line");
  });

  test("under a tenth of a mile reads as on the line", () => {
    expect(offLineLabel(80)).toBe("on your line");
  });
});

describe("intent chips", () => {
  const camp = stopRow({ category: "dec_campground" });
  const diner = stopRow({ category: "diner" });
  const dealer = stopRow({ category: "hd_dealer" });
  const road = {
    ...stopRow(),
    item_type: "segment",
  } as unknown as CorridorRow;

  test("no active chip shows everything", () => {
    for (const row of [camp, diner, dealer, road]) {
      expect(rowMatchesIntent(row, [])).toBe(true);
    }
  });

  test("active chips OR together and match their categories", () => {
    expect(rowMatchesIntent(camp, ["camping"])).toBe(true);
    expect(rowMatchesIntent(diner, ["camping"])).toBe(false);
    expect(rowMatchesIntent(diner, ["camping", "food"])).toBe(true);
  });

  test("twisty roads matches segments only", () => {
    expect(rowMatchesIntent(road, ["roads"])).toBe(true);
    expect(rowMatchesIntent(camp, ["roads"])).toBe(false);
  });

  test("dealers carry no chip and only show unfiltered", () => {
    for (const active of [["camping"], ["food"], ["overlooks"], ["roads"]]) {
      expect(rowMatchesIntent(dealer, active)).toBe(false);
    }
  });
});
