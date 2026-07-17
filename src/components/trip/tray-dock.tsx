"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";

import { useTrip } from "@/components/trip/trip-provider";
import { Button } from "@/components/ui/button";
import { distributeDayCounts, trayRuler } from "@/lib/trip";
import type { TrayCatalogEntry } from "@/lib/trip";
import { cn } from "@/lib/utils";

// The tray dock (wireframe v2, mark ⑤): add-to-trip's visible destination.
// Count, running miles against the framed target, last-added confirmation,
// ride-order chips, and the Build days bridge. Long-tray overflow (design.md
// Decision 9): the chips row is a single-row horizontal scroller; the stat
// block and Build days stay pinned outside it.
export function TrayDock({
  regionSlug,
  catalog,
  selectedId,
  onSelectAction,
  onEditFrameAction,
  activeDay = null,
}: {
  regionSlug: string;
  catalog: Map<string, TrayCatalogEntry>;
  selectedId: string | null;
  onSelectAction: (id: string) => void;
  onEditFrameAction: () => void;
  // Set on the days surface only: flips the ruler to day scope and retires
  // the Build days CTA (assembly is already on screen).
  activeDay?: { index: number; miles: number } | null;
}) {
  const trip = useTrip();
  const router = useRouter();

  const resolved = useMemo(
    () =>
      trip.items.flatMap((ref) => {
        const entry = catalog.get(ref.id);
        return entry ? [{ id: ref.id, ...entry }] : [];
      }),
    [trip.items, catalog]
  );
  const trayMiles = Math.round(resolved.reduce((sum, item) => sum + (item.lengthMi ?? 0), 0));

  // Whole-trip scope until Build days runs, then the active day's scope on
  // the days surface, never two rulers at once (design.md Decision 8).
  const ruler = trayRuler(trip.frame, trayMiles, activeDay);

  const lastAddedName = trip.lastAdded ? catalog.get(trip.lastAdded.id)?.name : null;

  const chipsRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(resolved.length);
  useEffect(() => {
    if (resolved.length > prevCount.current) {
      chipsRef.current?.lastElementChild?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    prevCount.current = resolved.length;
  }, [resolved.length]);

  const count = resolved.length;

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex w-56 shrink-0 flex-col gap-1">
          <p className="text-sm font-semibold tabular-nums">{`Trip · ${count} ${count === 1 ? "item" : "items"}`}</p>
          {ruler.scope === "trip" && trip.frame && (
            <>
              <p className="text-xs text-muted-foreground tabular-nums">
                {`${ruler.currentMi} of ${ruler.targetMi} mi planned`}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, (ruler.currentMi / ruler.targetMi) * 100)}%` }}
                />
              </div>
              <button
                type="button"
                onClick={onEditFrameAction}
                className="w-fit text-xs text-muted-foreground tabular-nums transition-colors hover:text-foreground"
              >
                {`${trip.frame.days} days × ${trip.frame.dailyMiles} mi · `}
                <span className="underline underline-offset-2">Change</span>
              </button>
            </>
          )}
          {ruler.scope === "day" && (
            <>
              <p className="text-xs text-muted-foreground tabular-nums">
                {`Day ${ruler.dayIndex} · ${ruler.currentMi} of ${ruler.targetMi} mi`}
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, (ruler.currentMi / ruler.targetMi) * 100)}%` }}
                />
              </div>
            </>
          )}
          {ruler.scope === "unframed" && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {`${ruler.currentMi} mi trayed · no frame set · `}
              <button
                type="button"
                onClick={onEditFrameAction}
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Set the frame
              </button>
            </p>
          )}
        </div>

        <p aria-live="polite" className="min-w-0 shrink-0 text-xs text-muted-foreground">
          {lastAddedName && (
            <span>
              <span aria-hidden="true">✓ </span>
              {`Added ${lastAddedName}`}
            </span>
          )}
        </p>

        {count === 0 ? (
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            The tray fills as you add. It never loses count.
          </p>
        ) : (
          <div
            ref={chipsRef}
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1"
          >
            {resolved.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === selectedId}
                onClick={() => onSelectAction(item.id)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                  item.id === selectedId && "border-foreground"
                )}
              >
                {item.night && <span aria-hidden="true">⌂ </span>}
                {item.name}
              </button>
            ))}
          </div>
        )}

        {count > 0 && !activeDay && (
          <div className="shrink-0">
            {trip.dayCounts ? (
              <Button asChild>
                <Link href={`/${regionSlug}/days`}>View days</Link>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  // Building days needs a ruler; unframed riders get the
                  // frame sheet first, then come back to the same button.
                  if (!trip.frame) {
                    onEditFrameAction();
                    return;
                  }
                  const entries = trip.items.map((ref) => {
                    const entry = catalog.get(ref.id);
                    return { lengthMi: entry?.lengthMi ?? null, night: entry?.night };
                  });
                  trip.buildDays(distributeDayCounts(entries, trip.frame.dailyMiles));
                  router.push(`/${regionSlug}/days`);
                }}
              >
                Build days
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
