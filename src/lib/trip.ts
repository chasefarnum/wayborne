// Client-side trip state (design.md Decision 1): frame + tray live in React
// state persisted to versioned localStorage. DB-backed trips are a later
// `trip-persistence` change.

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
