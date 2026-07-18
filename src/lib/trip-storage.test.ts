import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  EMPTY_TRIP,
  getTripServerSnapshot,
  getTripSnapshot,
  mutateTrip,
  subscribeTrip,
} from "@/lib/trip-storage";
import type { StoredTrip } from "@/lib/trip-storage";

// Node has no localStorage; a Map-backed stand-in keeps the tests
// deterministic without pulling in jsdom.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
});

// The storage key contract: version in the key, one key per region.
const keyFor = (slug: string) => `wayborne:trip:v1:${slug}`;

// The module keeps a per-region store cache across tests; unique slugs keep
// each test's store pristine.
let slugCounter = 0;
const freshSlug = () => `region-${++slugCounter}`;

const trip = (overrides: Partial<StoredTrip> = {}): StoredTrip => ({
  frame: { days: 3, dailyMiles: 200 },
  frameSkipped: false,
  items: [
    { id: "r-001", kind: "segment" },
    { id: "s-001", kind: "stop" },
  ],
  dayCounts: null,
  ...overrides,
});

describe("snapshots", () => {
  test("empty storage reads as the empty trip", () => {
    expect(getTripSnapshot(freshSlug())).toEqual(EMPTY_TRIP);
  });

  test("the server snapshot is always the empty trip", () => {
    expect(getTripServerSnapshot()).toEqual(EMPTY_TRIP);
  });

  test("repeated reads of unchanged storage return the same object", () => {
    const slug = freshSlug();
    mutateTrip(slug, () => trip());
    expect(getTripSnapshot(slug)).toBe(getTripSnapshot(slug));
  });
});

describe("mutate → read round trip", () => {
  test("a written trip survives re-read from storage", () => {
    const slug = freshSlug();
    const written = trip({ dayCounts: [1, 1] });
    mutateTrip(slug, () => written);
    expect(storage.getItem(keyFor(slug))).not.toBeNull();
    expect(getTripSnapshot(slug)).toEqual(written);
  });

  test("mutation notifies subscribers; unsubscribe stops it", () => {
    const slug = freshSlug();
    const listener = vi.fn();
    const unsubscribe = subscribeTrip(slug, listener);
    mutateTrip(slug, (t) => ({ ...t, frameSkipped: true }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    mutateTrip(slug, (t) => ({ ...t, frameSkipped: false }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("a failed localStorage write still updates the in-memory session", () => {
    const slug = freshSlug();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    mutateTrip(slug, () => trip());
    expect(getTripSnapshot(slug)).toEqual(trip());
  });
});

describe("parsing stored payloads", () => {
  const read = (slug: string, payload: unknown) => {
    storage.setItem(
      keyFor(slug),
      typeof payload === "string" ? payload : JSON.stringify(payload)
    );
    return getTripSnapshot(slug);
  };

  test("malformed JSON falls back to the empty trip", () => {
    expect(read(freshSlug(), "{not json")).toEqual(EMPTY_TRIP);
  });

  test("an invalid frame rejects the payload", () => {
    expect(read(freshSlug(), trip({ frame: { days: 0, dailyMiles: 200 } }))).toEqual(
      EMPTY_TRIP
    );
  });

  test("a malformed tray item rejects the payload", () => {
    expect(
      read(freshSlug(), { ...trip(), items: [{ id: "r-001", kind: "route" }] })
    ).toEqual(EMPTY_TRIP);
  });

  test("frameSkipped only counts when it is exactly true", () => {
    expect(read(freshSlug(), trip({ frameSkipped: true })).frameSkipped).toBe(true);
    const loose = { ...trip(), frameSkipped: "yes" };
    expect(read(freshSlug(), loose).frameSkipped).toBe(false);
  });

  test("duplicate item ids dedupe, keeping the first", () => {
    const result = read(freshSlug(), {
      ...trip({ dayCounts: null }),
      items: [
        { id: "r-001", kind: "segment" },
        { id: "r-001", kind: "segment" },
        { id: "s-001", kind: "stop" },
      ],
    });
    expect(result.items).toEqual([
      { id: "r-001", kind: "segment" },
      { id: "s-001", kind: "stop" },
    ]);
  });

  test("dayCounts that sum to items.length are kept", () => {
    expect(read(freshSlug(), trip({ dayCounts: [1, 1] })).dayCounts).toEqual([1, 1]);
  });

  test("dayCounts that break the sum invariant drop the days, never the tray", () => {
    const result = read(freshSlug(), trip({ dayCounts: [3] }));
    expect(result.dayCounts).toBeNull();
    expect(result.items).toHaveLength(2);
  });

  test("item pruning that breaks the sum drops the days, never the tray", () => {
    // Two stored items dedupe to one, so counts summing to 2 no longer fit.
    const result = read(freshSlug(), {
      ...trip(),
      items: [
        { id: "r-001", kind: "segment" },
        { id: "r-001", kind: "segment" },
      ],
      dayCounts: [2],
    });
    expect(result.items).toHaveLength(1);
    expect(result.dayCounts).toBeNull();
  });

  test("non-integer or negative dayCounts drop the days, never the tray", () => {
    expect(read(freshSlug(), trip({ dayCounts: [1.5, 0.5] })).dayCounts).toBeNull();
    expect(read(freshSlug(), trip({ dayCounts: [-1, 3] })).dayCounts).toBeNull();
  });
});
