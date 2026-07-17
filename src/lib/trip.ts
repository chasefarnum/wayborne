// Client-side trip state (design.md Decision 1): frame + tray live in React
// state persisted to versioned localStorage. DB-backed trips are a later
// `trip-persistence` change.

import type { SegmentRow, StopRow } from "@/lib/explore";

export type TripFrame = { days: number; dailyMiles: number };

export type TrayItemRef = { id: string; kind: "segment" | "stop" };

// What the tray needs to render a ref: resolved from the region's fetched
// rows, never persisted. Unknown ids (content since held or killed) drop out
// at resolution.
export type TrayCatalogEntry = {
  kind: "segment" | "stop";
  name: string;
  lengthMi: number | null;
  night?: boolean;
};

export const FRAME_DAYS_MIN = 1;
export const FRAME_DAYS_MAX = 14;
export const FRAME_MILES_MIN = 50;
export const FRAME_MILES_MAX = 500;

export function isValidFrame(days: number, dailyMiles: number): boolean {
  return (
    Number.isInteger(days) &&
    days >= FRAME_DAYS_MIN &&
    days <= FRAME_DAYS_MAX &&
    Number.isInteger(dailyMiles) &&
    dailyMiles >= FRAME_MILES_MIN &&
    dailyMiles <= FRAME_MILES_MAX
  );
}

export function tripTargetMi(frame: TripFrame): number {
  return frame.days * frame.dailyMiles;
}

// The ruler the tray meter reads (design.md Decision 8): whole-trip scope
// until "Build days" runs, then the active day's scope, never two rulers at
// once. `activeDay` stays null until assembly (task group 4) wires days.
export type TrayRuler =
  | { scope: "trip"; currentMi: number; targetMi: number }
  | { scope: "day"; dayIndex: number; currentMi: number; targetMi: number }
  | { scope: "unframed"; currentMi: number };

export function trayRuler(
  frame: TripFrame | null,
  trayMiles: number,
  activeDay: { index: number; miles: number } | null
): TrayRuler {
  if (frame && activeDay) {
    return {
      scope: "day",
      dayIndex: activeDay.index,
      currentMi: activeDay.miles,
      targetMi: frame.dailyMiles,
    };
  }
  if (frame) {
    return { scope: "trip", currentMi: trayMiles, targetMi: tripTargetMi(frame) };
  }
  return { scope: "unframed", currentMi: trayMiles };
}

// Everything the tray or a day leg needs to resolve a stored ref. Built from
// the region's fetched rows on both the explore and days surfaces.
export function trayCatalogFrom(
  segments: SegmentRow[],
  stops: StopRow[]
): Map<string, TrayCatalogEntry> {
  const m = new Map<string, TrayCatalogEntry>();
  for (const s of segments) {
    if (s.sweep_id) m.set(s.sweep_id, { kind: "segment", name: s.name, lengthMi: s.length_mi });
  }
  for (const s of stops) {
    if (s.sweep_id) {
      m.set(s.sweep_id, {
        kind: "stop",
        name: s.name,
        lengthMi: null,
        night: s.category === "dec_campground" || s.category === "private_campground",
      });
    }
  }
  return m;
}

// Day assembly (task 4.1): days are contiguous slices of the tray's ride
// order, stored as per-day item counts. Ride order stays the single source
// of truth, so moving between days and reordering within one are both plain
// list operations and the tray chips never disagree with the day legs.

export type DayEntry = { lengthMi: number | null; night?: boolean };

// Greedy walk in ride order: a day closes when the next road would push it
// past the daily target, or at a night stop — legs end where you sleep.
export function distributeDayCounts(entries: DayEntry[], dailyTargetMi: number): number[] {
  const counts: number[] = [];
  let count = 0;
  let miles = 0;
  const close = () => {
    counts.push(count);
    count = 0;
    miles = 0;
  };
  for (const entry of entries) {
    const mi = entry.lengthMi ?? 0;
    if (count > 0 && mi > 0 && miles + mi > dailyTargetMi) close();
    count += 1;
    miles += mi;
    if (entry.night) close();
  }
  if (count > 0) close();
  return counts.length > 0 ? counts : [0];
}

export function daySlices(dayCounts: number[]): { start: number; end: number }[] {
  const slices: { start: number; end: number }[] = [];
  let start = 0;
  for (const count of dayCounts) {
    slices.push({ start, end: start + count });
    start += count;
  }
  return slices;
}

export function dayIndexOf(dayCounts: number[], itemIndex: number): number {
  return daySlices(dayCounts).findIndex((s) => itemIndex >= s.start && itemIndex < s.end);
}

// One move primitive covers both gestures: inside a day it swaps neighbors;
// at a day edge it shifts the boundary, so the item changes days while the
// ride order stands still. Returns null when there is nowhere to go.
export function moveTrayItem<T>(
  items: T[],
  dayCounts: number[],
  index: number,
  dir: -1 | 1
): { items: T[]; dayCounts: number[] } | null {
  const day = dayIndexOf(dayCounts, index);
  if (day === -1) return null;
  const slice = daySlices(dayCounts)[day];

  const withinDay = dir === -1 ? index > slice.start : index < slice.end - 1;
  if (withinDay) {
    const next = [...items];
    const swap = index + dir;
    [next[index], next[swap]] = [next[swap], next[index]];
    return { items: next, dayCounts };
  }

  const neighborDay = day + dir;
  if (neighborDay < 0 || neighborDay >= dayCounts.length) return null;
  const counts = [...dayCounts];
  counts[neighborDay] += 1;
  counts[day] -= 1;
  return { items, dayCounts: counts };
}

// Fuel-gap detection (trip-assembly spec): a run of consecutive curated roads
// in a day with no stop planned between them. The mileage is the sum of the
// run's curated lengths, so it is computed from curation data, never
// illustrative. Connectors are unrouted, which makes the true distance at
// least this; the copy says so. Threshold set so the region's benchmark gap
// (the ~45 rural mi Margaretville-to-Walton run) triggers it.
export const FUEL_GAP_WARN_MI = 40;

export type FuelGap = { startIndex: number; miles: number };

export function dayFuelGaps(
  entries: { kind: "segment" | "stop"; lengthMi: number | null }[]
): FuelGap[] {
  const gaps: FuelGap[] = [];
  let runStart = -1;
  let runMiles = 0;
  const closeRun = () => {
    if (runStart >= 0 && runMiles >= FUEL_GAP_WARN_MI) {
      gaps.push({ startIndex: runStart, miles: Math.round(runMiles) });
    }
    runStart = -1;
    runMiles = 0;
  };
  entries.forEach((entry, i) => {
    if (entry.kind === "segment") {
      if (runStart < 0) runStart = i;
      runMiles += entry.lengthMi ?? 0;
    } else {
      closeRun();
    }
  });
  closeRun();
  return gaps;
}
