import { isValidFrame } from "@/lib/trip";
import type { TrayItemRef, TripFrame } from "@/lib/trip";

// Versioned localStorage (react-best-practices client-localstorage-schema):
// version in the key, minimal fields, every read/write wrapped. Bump the
// version and migrate when the shape changes.
//
// Shaped as an external store for useSyncExternalStore: localStorage is the
// hydration source and persistence target, the in-memory cache is the
// authority between writes (so private browsing still works for the session).
const VERSION = "v1";

export type StoredTrip = {
  frame: TripFrame | null;
  frameSkipped: boolean;
  items: TrayItemRef[];
  // Contiguous partition of `items` into day legs, as per-day counts; null
  // until "Build days" runs. Invariant: the counts sum to items.length.
  dayCounts: number[] | null;
};

export const EMPTY_TRIP: StoredTrip = {
  frame: null,
  frameSkipped: false,
  items: [],
  dayCounts: null,
};

function storageKey(regionSlug: string): string {
  return `wayborne:trip:${VERSION}:${regionSlug}`;
}

function parseTrip(raw: string): StoredTrip | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const { frame, frameSkipped, items, dayCounts } = data as Record<string, unknown>;

    let parsedFrame: TripFrame | null = null;
    if (frame !== null && frame !== undefined) {
      const f = frame as Record<string, unknown>;
      if (
        typeof f.days !== "number" ||
        typeof f.dailyMiles !== "number" ||
        !isValidFrame(f.days, f.dailyMiles)
      ) {
        return null;
      }
      parsedFrame = { days: f.days, dailyMiles: f.dailyMiles };
    }

    if (!Array.isArray(items)) return null;
    const seen = new Set<string>();
    const parsedItems: TrayItemRef[] = [];
    for (const item of items) {
      const i = item as Record<string, unknown>;
      if (typeof i?.id !== "string" || (i.kind !== "segment" && i.kind !== "stop")) return null;
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      parsedItems.push({ id: i.id, kind: i.kind });
    }

    // Day counts must still partition the items exactly (item validation above
    // can prune rows); anything off drops the days, never the tray.
    let parsedDayCounts: number[] | null = null;
    if (Array.isArray(dayCounts)) {
      const valid =
        dayCounts.every((c) => Number.isInteger(c) && (c as number) >= 0) &&
        dayCounts.reduce((sum: number, c) => sum + (c as number), 0) === parsedItems.length;
      if (valid) parsedDayCounts = dayCounts as number[];
    }

    return {
      frame: parsedFrame,
      frameSkipped: frameSkipped === true,
      items: parsedItems,
      dayCounts: parsedDayCounts,
    };
  } catch {
    return null;
  }
}

function readRaw(regionSlug: string): string | null {
  try {
    return localStorage.getItem(storageKey(regionSlug));
  } catch {
    return null;
  }
}

type TripStore = {
  listeners: Set<() => void>;
  // undefined = never read; distinct from null (key absent).
  cacheRaw: string | null | undefined;
  cache: StoredTrip;
};

const stores = new Map<string, TripStore>();

function getStore(regionSlug: string): TripStore {
  let store = stores.get(regionSlug);
  if (!store) {
    store = { listeners: new Set(), cacheRaw: undefined, cache: EMPTY_TRIP };
    stores.set(regionSlug, store);
  }
  return store;
}

export function subscribeTrip(regionSlug: string, listener: () => void): () => void {
  const store = getStore(regionSlug);
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

export function getTripSnapshot(regionSlug: string): StoredTrip {
  const store = getStore(regionSlug);
  const raw = readRaw(regionSlug);
  if (raw !== store.cacheRaw) {
    store.cacheRaw = raw;
    store.cache = (raw && parseTrip(raw)) || EMPTY_TRIP;
  }
  return store.cache;
}

export function getTripServerSnapshot(): StoredTrip {
  return EMPTY_TRIP;
}

export function mutateTrip(
  regionSlug: string,
  update: (trip: StoredTrip) => StoredTrip
): void {
  const store = getStore(regionSlug);
  const next = update(getTripSnapshot(regionSlug));
  try {
    localStorage.setItem(storageKey(regionSlug), JSON.stringify(next));
  } catch {
    // Private browsing or quota: the in-memory cache still carries the session.
  }
  store.cache = next;
  store.cacheRaw = readRaw(regionSlug);
  for (const listener of store.listeners) listener();
}
