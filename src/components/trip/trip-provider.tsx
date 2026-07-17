"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  getTripServerSnapshot,
  getTripSnapshot,
  mutateTrip,
  subscribeTrip,
} from "@/lib/trip-storage";
import type { TrayItemRef, TripFrame } from "@/lib/trip";

type TripContextValue = {
  frame: TripFrame | null;
  frameSkipped: boolean;
  items: TrayItemRef[];
  lastAdded: TrayItemRef | null;
  addItem: (ref: TrayItemRef) => void;
  removeItem: (id: string) => void;
  setFrame: (frame: TripFrame) => void;
};

const TripContext = createContext<TripContextValue | null>(null);

export function useTrip(): TripContextValue {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip requires a TripProvider");
  return value;
}

export function TripProvider({
  regionSlug,
  children,
}: {
  regionSlug: string;
  children: React.ReactNode;
}) {
  const trip = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeTrip(regionSlug, listener), [regionSlug]),
    useCallback(() => getTripSnapshot(regionSlug), [regionSlug]),
    getTripServerSnapshot
  );
  const [lastAdded, setLastAdded] = useState<TrayItemRef | null>(null);

  const addItem = useCallback(
    (ref: TrayItemRef) => {
      mutateTrip(regionSlug, (t) =>
        t.items.some((i) => i.id === ref.id) ? t : { ...t, items: [...t.items, ref] }
      );
      setLastAdded(ref);
    },
    [regionSlug]
  );

  const removeItem = useCallback(
    (id: string) => {
      mutateTrip(regionSlug, (t) => ({ ...t, items: t.items.filter((i) => i.id !== id) }));
      setLastAdded((prev) => (prev?.id === id ? null : prev));
    },
    [regionSlug]
  );

  const setFrame = useCallback(
    (frame: TripFrame) => {
      mutateTrip(regionSlug, (t) => ({ ...t, frame, frameSkipped: false }));
    },
    [regionSlug]
  );

  const value = useMemo(
    () => ({
      frame: trip.frame,
      frameSkipped: trip.frameSkipped,
      items: trip.items,
      lastAdded,
      addItem,
      removeItem,
      setFrame,
    }),
    [trip.frame, trip.frameSkipped, trip.items, lastAdded, addItem, removeItem, setFrame]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
