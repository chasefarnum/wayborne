// Versioned localStorage for the rider's active route, shaped as an external
// store for useSyncExternalStore, following the trip-storage discipline:
// version in the key, minimal fields, every read/write wrapped, in-memory
// cache as the authority between writes. The line is the rider's own data and
// legitimately one LineString (curated compositions never merge; this is not
// one). It lives only here: never in the URL, never server-side in v1.
const VERSION = "v1";

export type RouteSource = "tap" | "gpx";

export type StoredRoute = {
  line: GeoJSON.LineString;
  source: RouteSource;
  lengthMi: number;
  // Tap endpoints as [lon, lat], kept for edit and retry; null for GPX.
  start: [number, number] | null;
  end: [number, number] | null;
  // GPX file name for the route label; null for tap routes.
  name: string | null;
};

function storageKey(regionSlug: string): string {
  return `wayborne:route:${VERSION}:${regionSlug}`;
}

function isLonLat(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

function parseRoute(raw: string): StoredRoute | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const { line, source, lengthMi, start, end, name } = data as Record<string, unknown>;

    if (source !== "tap" && source !== "gpx") return null;
    if (typeof lengthMi !== "number" || !Number.isFinite(lengthMi) || lengthMi <= 0)
      return null;

    const l = line as { type?: unknown; coordinates?: unknown } | null;
    if (
      typeof l !== "object" ||
      l === null ||
      l.type !== "LineString" ||
      !Array.isArray(l.coordinates) ||
      l.coordinates.length < 2 ||
      !l.coordinates.every(isLonLat)
    ) {
      return null;
    }

    const parsedStart = start === null || start === undefined ? null : start;
    const parsedEnd = end === null || end === undefined ? null : end;
    if (parsedStart !== null && !isLonLat(parsedStart)) return null;
    if (parsedEnd !== null && !isLonLat(parsedEnd)) return null;

    return {
      line: { type: "LineString", coordinates: l.coordinates as [number, number][] },
      source,
      lengthMi,
      start: parsedStart,
      end: parsedEnd,
      name: typeof name === "string" ? name : null,
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

type RouteStore = {
  listeners: Set<() => void>;
  // undefined = never read; distinct from null (key absent).
  cacheRaw: string | null | undefined;
  cache: StoredRoute | null;
};

const stores = new Map<string, RouteStore>();

function getStore(regionSlug: string): RouteStore {
  let store = stores.get(regionSlug);
  if (!store) {
    store = { listeners: new Set(), cacheRaw: undefined, cache: null };
    stores.set(regionSlug, store);
  }
  return store;
}

export function subscribeRoute(regionSlug: string, listener: () => void): () => void {
  const store = getStore(regionSlug);
  store.listeners.add(listener);
  return () => store.listeners.delete(listener);
}

export function getRouteSnapshot(regionSlug: string): StoredRoute | null {
  const store = getStore(regionSlug);
  const raw = readRaw(regionSlug);
  if (raw !== store.cacheRaw) {
    store.cacheRaw = raw;
    store.cache = raw ? parseRoute(raw) : null;
  }
  return store.cache;
}

export function getRouteServerSnapshot(): StoredRoute | null {
  return null;
}

export function setRoute(regionSlug: string, route: StoredRoute): void {
  const store = getStore(regionSlug);
  try {
    localStorage.setItem(storageKey(regionSlug), JSON.stringify(route));
  } catch {
    // Private browsing or quota: the in-memory cache still carries the session.
  }
  store.cache = route;
  store.cacheRaw = readRaw(regionSlug);
  for (const listener of store.listeners) listener();
}

export function clearRoute(regionSlug: string): void {
  const store = getStore(regionSlug);
  try {
    localStorage.removeItem(storageKey(regionSlug));
  } catch {
    // Removal failing leaves stale storage; the cache still clears the session.
  }
  store.cache = null;
  store.cacheRaw = readRaw(regionSlug);
  for (const listener of store.listeners) listener();
}
