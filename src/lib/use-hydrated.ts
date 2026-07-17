"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// True only after hydration. Lets client surfaces that read localStorage-backed
// trip state hold their tongue during the server-snapshot render instead of
// flashing the empty-trip shape.
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
