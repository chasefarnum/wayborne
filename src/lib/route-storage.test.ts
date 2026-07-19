import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  clearRoute,
  getRouteServerSnapshot,
  getRouteSnapshot,
  setRoute,
  subscribeRoute,
} from "@/lib/route-storage";
import type { StoredRoute } from "@/lib/route-storage";

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
const keyFor = (slug: string) => `wayborne:route:v1:${slug}`;

// The module keeps a per-region store cache across tests; unique slugs keep
// each test's store pristine.
let slugCounter = 0;
const freshSlug = () => `region-${++slugCounter}`;

const route = (overrides: Partial<StoredRoute> = {}): StoredRoute => ({
  line: {
    type: "LineString",
    coordinates: [
      [-73.9974, 41.927],
      [-74.3171, 42.0854],
    ],
  },
  source: "tap",
  lengthMi: 25.2,
  start: [-73.9974, 41.927],
  end: [-74.3171, 42.0854],
  name: null,
  ...overrides,
});

describe("snapshots", () => {
  test("empty storage reads as no route", () => {
    expect(getRouteSnapshot(freshSlug())).toBeNull();
  });

  test("the server snapshot is always no route", () => {
    expect(getRouteServerSnapshot()).toBeNull();
  });

  test("repeated reads of unchanged storage return the same object", () => {
    const slug = freshSlug();
    setRoute(slug, route());
    expect(getRouteSnapshot(slug)).toBe(getRouteSnapshot(slug));
  });
});

describe("set → read → clear round trip", () => {
  test("a written route survives re-read from storage", () => {
    const slug = freshSlug();
    const written = route({ source: "gpx", name: "catskills-day-2.gpx", start: null, end: null });
    setRoute(slug, written);
    expect(storage.getItem(keyFor(slug))).not.toBeNull();
    expect(getRouteSnapshot(slug)).toEqual(written);
  });

  test("set and clear notify subscribers; unsubscribe stops it", () => {
    const slug = freshSlug();
    const listener = vi.fn();
    const unsubscribe = subscribeRoute(slug, listener);
    setRoute(slug, route());
    expect(listener).toHaveBeenCalledTimes(1);
    clearRoute(slug);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setRoute(slug, route());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("clear removes the stored key and the session route", () => {
    const slug = freshSlug();
    setRoute(slug, route());
    clearRoute(slug);
    expect(storage.getItem(keyFor(slug))).toBeNull();
    expect(getRouteSnapshot(slug)).toBeNull();
  });

  test("a failed localStorage write still updates the in-memory session", () => {
    const slug = freshSlug();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setRoute(slug, route());
    expect(getRouteSnapshot(slug)).toEqual(route());
  });
});

describe("parsing stored payloads", () => {
  const read = (slug: string, payload: unknown) => {
    storage.setItem(
      keyFor(slug),
      typeof payload === "string" ? payload : JSON.stringify(payload)
    );
    return getRouteSnapshot(slug);
  };

  test("malformed JSON falls back to no route", () => {
    expect(read(freshSlug(), "{not json")).toBeNull();
  });

  test("an unknown source rejects the payload", () => {
    expect(read(freshSlug(), { ...route(), source: "drawn" })).toBeNull();
  });

  test("a line that is not a LineString rejects the payload", () => {
    expect(
      read(freshSlug(), { ...route(), line: { type: "Point", coordinates: [0, 0] } })
    ).toBeNull();
  });

  test("a line with fewer than two positions rejects the payload", () => {
    expect(
      read(freshSlug(), {
        ...route(),
        line: { type: "LineString", coordinates: [[-74, 42]] },
      })
    ).toBeNull();
  });

  test("non-finite coordinates reject the payload", () => {
    expect(
      read(freshSlug(), {
        ...route(),
        line: {
          type: "LineString",
          coordinates: [
            [-74, 42],
            ["east", 42],
          ],
        },
      })
    ).toBeNull();
  });

  test("a non-positive length rejects the payload", () => {
    expect(read(freshSlug(), route({ lengthMi: 0 }))).toBeNull();
    expect(read(freshSlug(), { ...route(), lengthMi: "25" })).toBeNull();
  });

  test("gpx routes carry null endpoints and keep their file name", () => {
    const result = read(
      freshSlug(),
      route({ source: "gpx", start: null, end: null, name: "loop.gpx" })
    );
    expect(result).not.toBeNull();
    expect(result!.start).toBeNull();
    expect(result!.name).toBe("loop.gpx");
  });

  test("a malformed tap endpoint rejects the payload", () => {
    expect(read(freshSlug(), { ...route(), start: [-74] })).toBeNull();
  });
});
