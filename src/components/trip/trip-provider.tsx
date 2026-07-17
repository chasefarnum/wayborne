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
import { dayIndexOf, moveTrayItem } from "@/lib/trip";
import type { TrayItemRef, TripFrame } from "@/lib/trip";

type TripContextValue = {
  frame: TripFrame | null;
  frameSkipped: boolean;
  items: TrayItemRef[];
  dayCounts: number[] | null;
  lastAdded: TrayItemRef | null;
  addItem: (ref: TrayItemRef) => void;
  removeItem: (id: string) => void;
  setFrame: (frame: TripFrame) => void;
  skipFrame: () => void;
  buildDays: (dayCounts: number[]) => void;
  moveItem: (itemIndex: number, dir: -1 | 1) => void;
  addDay: () => void;
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
      mutateTrip(regionSlug, (t) => {
        if (t.items.some((i) => i.id === ref.id)) return t;
        // Once days exist, new items land at the end of the last day so the
        // counts keep partitioning the ride order.
        const dayCounts = t.dayCounts
          ? t.dayCounts.map((c, i) => (i === t.dayCounts!.length - 1 ? c + 1 : c))
          : null;
        return { ...t, items: [...t.items, ref], dayCounts };
      });
      setLastAdded(ref);
    },
    [regionSlug]
  );

  const removeItem = useCallback(
    (id: string) => {
      mutateTrip(regionSlug, (t) => {
        const index = t.items.findIndex((i) => i.id === id);
        if (index === -1) return t;
        let dayCounts = t.dayCounts;
        if (dayCounts) {
          const day = dayIndexOf(dayCounts, index);
          dayCounts = dayCounts.map((c, i) => (i === day ? c - 1 : c));
        }
        return { ...t, items: t.items.filter((_, i) => i !== index), dayCounts };
      });
      setLastAdded((prev) => (prev?.id === id ? null : prev));
    },
    [regionSlug]
  );

  const buildDays = useCallback(
    (dayCounts: number[]) => {
      mutateTrip(regionSlug, (t) => ({ ...t, dayCounts }));
    },
    [regionSlug]
  );

  const moveItem = useCallback(
    (itemIndex: number, dir: -1 | 1) => {
      mutateTrip(regionSlug, (t) => {
        if (!t.dayCounts) return t;
        const moved = moveTrayItem(t.items, t.dayCounts, itemIndex, dir);
        return moved ? { ...t, items: moved.items, dayCounts: moved.dayCounts } : t;
      });
    },
    [regionSlug]
  );

  const addDay = useCallback(() => {
    mutateTrip(regionSlug, (t) =>
      t.dayCounts ? { ...t, dayCounts: [...t.dayCounts, 0] } : t
    );
  }, [regionSlug]);

  const setFrame = useCallback(
    (frame: TripFrame) => {
      mutateTrip(regionSlug, (t) => ({ ...t, frame, frameSkipped: false }));
    },
    [regionSlug]
  );

  const skipFrame = useCallback(() => {
    mutateTrip(regionSlug, (t) => ({ ...t, frameSkipped: true }));
  }, [regionSlug]);

  const value = useMemo(
    () => ({
      frame: trip.frame,
      frameSkipped: trip.frameSkipped,
      items: trip.items,
      dayCounts: trip.dayCounts,
      lastAdded,
      addItem,
      removeItem,
      setFrame,
      skipFrame,
      buildDays,
      moveItem,
      addDay,
    }),
    [
      trip.frame,
      trip.frameSkipped,
      trip.items,
      trip.dayCounts,
      lastAdded,
      addItem,
      removeItem,
      setFrame,
      skipFrame,
      buildDays,
      moveItem,
      addDay,
    ]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
