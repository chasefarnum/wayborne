"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  clearRoute,
  getRouteServerSnapshot,
  getRouteSnapshot,
  setRoute,
  subscribeRoute,
} from "@/lib/route-storage";
import type { StoredRoute } from "@/lib/route-storage";

// The active route as React state: useSyncExternalStore over the versioned
// localStorage store, same shape as the trip provider's persistence. The
// server snapshot is always null, so route-mode UI only appears after
// hydration (pair with useHydrated where flicker matters).
export function useRoute(regionSlug: string) {
  const route = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeRoute(regionSlug, listener), [regionSlug]),
    () => getRouteSnapshot(regionSlug),
    getRouteServerSnapshot
  );

  const set = useCallback((next: StoredRoute) => setRoute(regionSlug, next), [regionSlug]);
  const clear = useCallback(() => clearRoute(regionSlug), [regionSlug]);

  return { route, setRoute: set, clearRoute: clear };
}
