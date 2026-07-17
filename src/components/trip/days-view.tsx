"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useMemo } from "react";

import { FrameSheet } from "@/components/frame/frame-sheet";
import { TrayDock } from "@/components/trip/tray-dock";
import { useTrip } from "@/components/trip/trip-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Warn, WarnFlag } from "@/components/warn";
import { CATEGORY_LABELS, characterLabel } from "@/lib/explore";
import type { SegmentRow, StopRow } from "@/lib/explore";
import {
  dayFuelGaps,
  dayIndexOf,
  daySlices,
  moveTrayItem,
  trayCatalogFrom,
} from "@/lib/trip";
import type { FuelGap } from "@/lib/trip";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const NIGHT_CATEGORIES = new Set<StopRow["category"]>([
  "dec_campground",
  "private_campground",
]);

type ResolvedLeg =
  | { flatIndex: number; kind: "segment"; segment: SegmentRow }
  | { flatIndex: number; kind: "stop"; stop: StopRow };

type DayPlan = {
  legs: ResolvedLeg[];
  miles: number;
  fuelGaps: FuelGap[];
  nightAnchored: boolean;
};

// The assembly surface (wireframe v2, Screen 4 + State A): day rail, day
// detail with per-day meter, move/reorder, warning furniture at the leg,
// connector placeholders. The tray dock rides along in day scope, so the two
// surfaces never show two rulers at once (design.md Decision 8).
export function DaysView({
  regionSlug,
  regionName,
  segments,
  stops,
}: {
  regionSlug: string;
  regionName: string;
  segments: SegmentRow[];
  stops: StopRow[];
}) {
  const trip = useTrip();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const segmentsById = useMemo(() => {
    const m = new Map<string, SegmentRow>();
    for (const s of segments) if (s.sweep_id) m.set(s.sweep_id, s);
    return m;
  }, [segments]);
  const stopsById = useMemo(() => {
    const m = new Map<string, StopRow>();
    for (const s of stops) if (s.sweep_id) m.set(s.sweep_id, s);
    return m;
  }, [stops]);
  const trayCatalog = useMemo(() => trayCatalogFrom(segments, stops), [segments, stops]);

  const dayCounts = trip.dayCounts;
  const hasDays = dayCounts != null && dayCounts.length > 0;

  const days = useMemo<DayPlan[]>(() => {
    if (!hasDays) return [];
    return daySlices(dayCounts).map((slice) => {
      const legs: ResolvedLeg[] = [];
      // Unknown refs (content since held or killed) drop out at resolution,
      // same rule as the tray.
      for (let i = slice.start; i < slice.end; i++) {
        const ref = trip.items[i];
        if (!ref) continue;
        if (ref.kind === "segment") {
          const segment = segmentsById.get(ref.id);
          if (segment) legs.push({ flatIndex: i, kind: "segment", segment });
        } else {
          const stop = stopsById.get(ref.id);
          if (stop) legs.push({ flatIndex: i, kind: "stop", stop });
        }
      }
      const miles = Math.round(
        legs.reduce(
          (sum, leg) => sum + (leg.kind === "segment" ? (leg.segment.length_mi ?? 0) : 0),
          0
        )
      );
      const fuelGaps = dayFuelGaps(
        legs.map((leg) => ({
          kind: leg.kind,
          lengthMi: leg.kind === "segment" ? leg.segment.length_mi : null,
        }))
      );
      const last = legs[legs.length - 1];
      const nightAnchored = last?.kind === "stop" && NIGHT_CATEGORIES.has(last.stop.category);
      return { legs, miles, fuelGaps, nightAnchored };
    });
  }, [hasDays, dayCounts, trip.items, segmentsById, stopsById]);

  const dayParam = Number(searchParams.get("day"));
  const activeIndex =
    days.length === 0
      ? 0
      : Math.min(
          Math.max(Number.isInteger(dayParam) && dayParam >= 1 ? dayParam - 1 : 0, 0),
          days.length - 1
        );
  const active = days[activeIndex];

  const target = trip.frame?.dailyMiles ?? null;
  const totalMiles = days.reduce((sum, d) => sum + d.miles, 0);

  const canMove = (flatIndex: number, dir: -1 | 1) =>
    dayCounts != null && moveTrayItem(trip.items, dayCounts, flatIndex, dir) != null;

  // w-full for the same reason as explore-view: a fit-content flex item in
  // the body's column flex collapses to its widest child without it.
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold">{regionName}</h1>
          {hasDays && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {`${totalMiles} mi across ${days.length} ${days.length === 1 ? "day" : "days"} · draft`}
            </p>
          )}
        </div>
        <Link
          href={`/${regionSlug}/plan`}
          className="text-sm underline underline-offset-2 hover:text-foreground"
        >
          Back to the map
        </Link>
      </header>

      {hydrated && !hasDays && (
        <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="text-sm font-semibold">No days built yet.</p>
          <p className="text-sm text-muted-foreground">
            Tray roads and stops on the map, then hit Build days. They land here as rideable
            daily legs.
          </p>
          <Button asChild size="sm">
            <Link href={`/${regionSlug}/plan`}>Back to the map</Link>
          </Button>
        </div>
      )}

      {hydrated && hasDays && active && (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Days" className="flex flex-row flex-wrap content-start gap-1.5 lg:flex-col">
            {days.map((day, i) => (
              <button
                key={i}
                type="button"
                aria-current={i === activeIndex ? "page" : undefined}
                onClick={() => setParams({ day: String(i + 1) })}
                className={cn(
                  "flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors hover:bg-accent",
                  i === activeIndex && "border-foreground"
                )}
              >
                <span className="text-sm font-medium">{`Day ${i + 1}`}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {`${day.miles} mi`}
                  {day.fuelGaps.length > 0 ? (
                    <>
                      {" · "}
                      <WarnFlag>fuel</WarnFlag>
                    </>
                  ) : target != null && day.miles > 0 && day.miles <= target ? (
                    " ✓"
                  ) : null}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                trip.addDay();
                setParams({ day: String(days.length + 1) });
              }}
              className="rounded-xl border border-dashed px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              + Add day
            </button>
            <div className="mt-2 flex w-full flex-col gap-0.5 rounded-xl border p-3">
              <span className="text-xs text-muted-foreground">Daily target</span>
              {target != null ? (
                <>
                  <span className="text-sm font-semibold tabular-nums">{`${target} mi`}</span>
                  <button
                    type="button"
                    onClick={() => setParams({ frame: "1" })}
                    className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    From your frame ·{" "}
                    <span className="underline underline-offset-2">Change</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setParams({ frame: "1" })}
                  className="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  No frame set ·{" "}
                  <span className="underline underline-offset-2">Set the frame</span>
                </button>
              )}
            </div>
          </nav>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{`Day ${activeIndex + 1}`}</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {target != null
                  ? `${active.miles} of ${target} mi target`
                  : `${active.miles} mi · no frame set`}
              </span>
            </div>
            {target != null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-foreground"
                  style={{ width: `${Math.min(100, (active.miles / target) * 100)}%` }}
                />
              </div>
            )}

            {active.legs.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-xl border p-4">
                <p className="text-sm font-semibold">{`Nothing on Day ${activeIndex + 1} yet.`}</p>
                <p className="text-sm text-muted-foreground">
                  Pull roads and stops straight off the map; they land here in ride order.
                </p>
                <Button asChild size="sm">
                  <Link href={`/${regionSlug}/plan`}>Add from the map</Link>
                </Button>
                {trip.frame && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {`Your frame: ${trip.frame.days} days at ${trip.frame.dailyMiles} mi a day.`}
                  </span>
                )}
              </div>
            ) : (
              active.legs.map((leg, idx) => (
                <Fragment key={leg.kind === "segment" ? leg.segment.id : leg.stop.id}>
                  {idx > 0 && <Connector />}
                  <LegRow
                    leg={leg}
                    fuelGap={active.fuelGaps.find((g) => g.startIndex === idx) ?? null}
                    canMoveUp={canMove(leg.flatIndex, -1)}
                    canMoveDown={canMove(leg.flatIndex, 1)}
                    onMoveAction={(dir) => trip.moveItem(leg.flatIndex, dir)}
                  />
                </Fragment>
              ))
            )}

            {!active.nightAnchored && (
              <div className="flex flex-col items-start gap-1.5 rounded-xl border border-dashed p-3">
                <p className="text-sm font-medium">
                  <span aria-hidden="true">⌂ </span>
                  Night anchor still open
                </p>
                <p className="text-xs text-muted-foreground">
                  Every day ends where you sleep. Pick a camp before export.
                </p>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/${regionSlug}/plan?stops=camping`}>Find camps</Link>
                </Button>
              </div>
            )}
          </section>
        </div>
      )}

      <TrayDock
        regionSlug={regionSlug}
        catalog={trayCatalog}
        selectedId={null}
        onSelectAction={(id) => {
          const index = trip.items.findIndex((ref) => ref.id === id);
          if (index >= 0 && dayCounts) {
            setParams({ day: String(dayIndexOf(dayCounts, index) + 1) });
          }
        }}
        onEditFrameAction={() => setParams({ frame: "1" })}
        activeDay={active ? { index: activeIndex + 1, miles: active.miles } : null}
      />

      <FrameSheet />
    </div>
  );
}

// Connector placeholder (design.md Decision 6): routing is not wired in this
// change, and with no traced geometry there is no honest distance to show, so
// the placeholder says exactly what the day's count does and does not include.
function Connector() {
  return (
    <p className="ml-5 border-l-2 border-dashed py-0.5 pl-3 text-xs text-muted-foreground">
      Connector · not routed yet · miles not counted
    </p>
  );
}

function LegRow({
  leg,
  fuelGap,
  canMoveUp,
  canMoveDown,
  onMoveAction,
}: {
  leg: ResolvedLeg;
  fuelGap: FuelGap | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveAction: (dir: -1 | 1) => void;
}) {
  const isSegment = leg.kind === "segment";
  const item = isSegment ? leg.segment : leg.stop;
  const night = !isSegment && NIGHT_CATEGORIES.has(leg.stop.category);

  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border p-3", night && "bg-muted/50")}>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">
          {night && <span aria-hidden="true">⌂ </span>}
          {item.name}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant="outline">{item.provenance}</Badge>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Move ${item.name} earlier`}
            disabled={!canMoveUp}
            onClick={() => onMoveAction(-1)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Move ${item.name} later`}
            disabled={!canMoveDown}
            onClick={() => onMoveAction(1)}
          >
            ↓
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {isSegment ? (
          <>
            {leg.segment.length_mi != null && <>{leg.segment.length_mi} mi · </>}
            {leg.segment.character.map(characterLabel).join(" · ")}
          </>
        ) : (
          <>
            {CATEGORY_LABELS[leg.stop.category]}
            {leg.stop.town && <> · {leg.stop.town}</>}
          </>
        )}
      </p>
      {fuelGap && (
        <Warn>
          {`Fuel gap: at least ${fuelGap.miles} mi of road from here to the next planned stop. Top off before this run.`}
        </Warn>
      )}
      {isSegment && leg.segment.warnings && <Warn>{leg.segment.warnings}</Warn>}
      {item.seasonal_notes && <Warn>{item.seasonal_notes}</Warn>}
    </div>
  );
}
