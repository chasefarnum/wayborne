import { describe, expect, test } from "vitest";

import {
  FRAME_DAYS_MAX,
  FRAME_DAYS_MIN,
  FRAME_MILES_MAX,
  FRAME_MILES_MIN,
  FUEL_GAP_WARN_MI,
  dayFuelGaps,
  dayIndexOf,
  daySlices,
  distributeDayCounts,
  isValidFrame,
  moveTrayItem,
  trayRuler,
  tripTargetMi,
} from "@/lib/trip";
import type { DayEntry } from "@/lib/trip";

const seg = (lengthMi: number | null): DayEntry => ({ lengthMi });
const stop = (): DayEntry => ({ lengthMi: null });
const nightStop = (): DayEntry => ({ lengthMi: null, night: true });

describe("isValidFrame", () => {
  test("accepts a mid-range frame", () => {
    expect(isValidFrame(3, 200)).toBe(true);
  });

  test("bounds are inclusive on both ends", () => {
    expect(isValidFrame(FRAME_DAYS_MIN, FRAME_MILES_MIN)).toBe(true);
    expect(isValidFrame(FRAME_DAYS_MAX, FRAME_MILES_MAX)).toBe(true);
  });

  test("the bounds themselves are the spec'd literals", () => {
    // Pinned as literals so a silently drifted constant fails here, not
    // nowhere (fresh-eyes finding: constant-echo tests survive that mutation).
    expect([FRAME_DAYS_MIN, FRAME_DAYS_MAX, FRAME_MILES_MIN, FRAME_MILES_MAX]).toEqual([
      1, 14, 50, 500,
    ]);
    expect(FUEL_GAP_WARN_MI).toBe(40);
  });

  test("rejects values outside the bounds", () => {
    expect(isValidFrame(FRAME_DAYS_MIN - 1, 200)).toBe(false);
    expect(isValidFrame(FRAME_DAYS_MAX + 1, 200)).toBe(false);
    expect(isValidFrame(3, FRAME_MILES_MIN - 1)).toBe(false);
    expect(isValidFrame(3, FRAME_MILES_MAX + 1)).toBe(false);
  });

  test("rejects non-integers", () => {
    expect(isValidFrame(2.5, 200)).toBe(false);
    expect(isValidFrame(3, 199.5)).toBe(false);
    expect(isValidFrame(NaN, 200)).toBe(false);
  });
});

describe("tripTargetMi", () => {
  test("multiplies days by daily mileage", () => {
    expect(tripTargetMi({ days: 3, dailyMiles: 200 })).toBe(600);
  });
});

describe("trayRuler", () => {
  test("unframed scope when no frame exists, even mid-assembly", () => {
    expect(trayRuler(null, 120, null)).toEqual({ scope: "unframed", currentMi: 120 });
    expect(trayRuler(null, 120, { index: 0, miles: 80 })).toEqual({
      scope: "unframed",
      currentMi: 120,
    });
  });

  test("trip scope before days exist, measured against the whole trip", () => {
    expect(trayRuler({ days: 3, dailyMiles: 200 }, 150, null)).toEqual({
      scope: "trip",
      currentMi: 150,
      targetMi: 600,
    });
  });

  test("day scope once a day is active, measured against the daily target", () => {
    expect(trayRuler({ days: 3, dailyMiles: 200 }, 450, { index: 1, miles: 180 })).toEqual({
      scope: "day",
      dayIndex: 1,
      currentMi: 180,
      targetMi: 200,
    });
  });
});

describe("distributeDayCounts", () => {
  test("empty tray still yields one (empty) day", () => {
    expect(distributeDayCounts([], 200)).toEqual([0]);
  });

  test("greedy walk closes a day when the next road would overshoot", () => {
    expect(distributeDayCounts([seg(100), seg(100), seg(100)], 200)).toEqual([2, 1]);
  });

  test("a single road never splits, even over the target", () => {
    expect(distributeDayCounts([seg(500)], 200)).toEqual([1]);
    // First item of a fresh day joins that day regardless of size.
    expect(distributeDayCounts([seg(180), seg(500)], 200)).toEqual([1, 1]);
  });

  test("a night stop closes its day", () => {
    expect(distributeDayCounts([seg(100), nightStop(), seg(100)], 200)).toEqual([2, 1]);
  });

  test("a trailing night stop leaves no empty day behind", () => {
    expect(distributeDayCounts([seg(100), nightStop()], 200)).toEqual([2]);
  });

  test("stops contribute zero miles and never trigger the overflow split", () => {
    expect(
      distributeDayCounts([seg(190), stop(), stop(), stop(), seg(10)], 200)
    ).toEqual([5]);
  });

  test("counts always sum to the entry count", () => {
    const entries = [seg(80), stop(), seg(120), nightStop(), seg(60), seg(200)];
    const counts = distributeDayCounts(entries, 200);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(entries.length);
  });
});

describe("daySlices / dayIndexOf", () => {
  test("slices are contiguous over ride order", () => {
    expect(daySlices([2, 1])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ]);
  });

  test("dayIndexOf maps items to their day, -1 outside the partition", () => {
    expect(dayIndexOf([2, 1], 0)).toBe(0);
    expect(dayIndexOf([2, 1], 1)).toBe(0);
    expect(dayIndexOf([2, 1], 2)).toBe(1);
    expect(dayIndexOf([2, 1], 3)).toBe(-1);
  });
});

describe("moveTrayItem", () => {
  const items = ["a", "b", "c"];

  test("inside a day it swaps neighbors and keeps the day counts", () => {
    const moved = moveTrayItem(items, [3], 0, 1);
    expect(moved).toEqual({ items: ["b", "a", "c"], dayCounts: [3] });
    // Input untouched.
    expect(items).toEqual(["a", "b", "c"]);
  });

  test("at a day edge it shifts the boundary; ride order never changes", () => {
    const down = moveTrayItem(items, [2, 1], 1, 1);
    expect(down).toEqual({ items: ["a", "b", "c"], dayCounts: [1, 2] });

    const up = moveTrayItem(items, [2, 1], 2, -1);
    expect(up).toEqual({ items: ["a", "b", "c"], dayCounts: [3, 0] });
  });

  test("returns null when there is nowhere to go", () => {
    expect(moveTrayItem(items, [3], 0, -1)).toBeNull();
    expect(moveTrayItem(items, [3], 2, 1)).toBeNull();
  });

  test("returns null for an index outside the partition", () => {
    expect(moveTrayItem(items, [3], 5, 1)).toBeNull();
  });

  test("every successful move preserves the counts-sum invariant", () => {
    for (const [counts, index, dir] of [
      [[2, 1], 1, 1],
      [[2, 1], 2, -1],
      [[1, 1, 1], 1, 1],
      [[3], 1, -1],
    ] as const) {
      const moved = moveTrayItem(items, [...counts], index, dir);
      if (moved) {
        expect(moved.dayCounts.reduce((a, b) => a + b, 0)).toBe(items.length);
      }
    }
  });
});

describe("dayFuelGaps", () => {
  const road = (lengthMi: number | null) => ({ kind: "segment" as const, lengthMi });
  const stopAt = () => ({ kind: "stop" as const, lengthMi: null });

  test("warns on a run of consecutive roads at or over the threshold", () => {
    expect(dayFuelGaps([road(25), road(20)])).toEqual([{ startIndex: 0, miles: 45 }]);
    expect(dayFuelGaps([road(FUEL_GAP_WARN_MI)])).toEqual([
      { startIndex: 0, miles: FUEL_GAP_WARN_MI },
    ]);
  });

  test("stays quiet just under the threshold", () => {
    expect(dayFuelGaps([road(39.9)])).toEqual([]);
  });

  test("a planned stop breaks the run", () => {
    expect(dayFuelGaps([road(30), stopAt(), road(30)])).toEqual([]);
  });

  test("reports each qualifying run with its start index", () => {
    expect(dayFuelGaps([road(45), stopAt(), road(50)])).toEqual([
      { startIndex: 0, miles: 45 },
      { startIndex: 2, miles: 50 },
    ]);
  });

  test("rounds the reported mileage", () => {
    expect(dayFuelGaps([road(40.4)])).toEqual([{ startIndex: 0, miles: 40 }]);
  });

  test("treats unknown road length as zero, never inflating the gap", () => {
    expect(dayFuelGaps([road(null), road(39)])).toEqual([]);
  });
});
