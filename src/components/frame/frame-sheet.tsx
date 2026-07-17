"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import { useTrip } from "@/components/trip/trip-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FRAME_DAYS_MAX } from "@/lib/trip";
import type { TripFrame } from "@/lib/trip";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

const DAY_CHOICES = [2, 3, 4] as const;
const MILES_MIN = 100;
const MILES_MAX = 400;
const MILES_STEP = 25;

// The frame sheet (2026-07-17 refinement, replacing the /frame page): the
// rider's time budget asked as a dialog over explore. Auto-opens on the first
// unframed visit; dismissing while unframed records an honest skip, never a
// silent default (trip-frame spec, "Frame skipped" scenario). Reopens via the
// ?frame=1 param so Change / Set the frame stay deep-linkable.
export function FrameSheet({
  autoOpen = false,
  syncFrameParams = false,
}: {
  autoOpen?: boolean;
  // On explore, ?days&mi are the deep-link authority; commits reflect the new
  // frame into those params so the URL and storage never argue.
  syncFrameParams?: boolean;
}) {
  const { frame, frameSkipped, setFrame, skipFrame } = useTrip();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydrated = useHydrated();

  const paramOpen = searchParams.get("frame") === "1";
  const open = paramOpen || (autoOpen && hydrated && !frame && !frameSkipped);

  const replaceParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const commit = (next: TripFrame) => {
    setFrame(next);
    replaceParams((p) => {
      p.delete("frame");
      if (syncFrameParams) {
        p.set("days", String(next.days));
        p.set("mi", String(next.dailyMiles));
      }
    });
  };

  const dismiss = () => {
    if (!frame) skipFrame();
    replaceParams((p) => p.delete("frame"));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How much ride do you have?</DialogTitle>
          <DialogDescription>
            Answer in rider terms. This sets the ruler every day gets measured against.
          </DialogDescription>
        </DialogHeader>
        <FrameFields storedFrame={frame} onSetAction={commit} onDismissAction={dismiss} />
      </DialogContent>
    </Dialog>
  );
}

// Mounts fresh each time the dialog opens, so the fields always prefill from
// the frame as it stands at open time.
function FrameFields({
  storedFrame,
  onSetAction,
  onDismissAction,
}: {
  storedFrame: TripFrame | null;
  onSetAction: (frame: TripFrame) => void;
  onDismissAction: () => void;
}) {
  const [days, setDays] = useState(storedFrame?.days ?? 3);
  const [manyDays, setManyDays] = useState((storedFrame?.days ?? 3) > 4);
  const [miles, setMiles] = useState(storedFrame?.dailyMiles ?? 200);

  const segClasses = (active: boolean) =>
    cn(
      "rounded-md border px-4 py-2 text-sm transition-colors hover:bg-accent",
      active && "border-foreground bg-foreground text-background hover:bg-foreground/90"
    );

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">How many days?</legend>
        <div className="flex items-center gap-2">
          {DAY_CHOICES.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={!manyDays && days === d}
              onClick={() => {
                setManyDays(false);
                setDays(d);
              }}
              className={segClasses(!manyDays && days === d)}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={manyDays}
            onClick={() => {
              setManyDays(true);
              setDays((d) => Math.max(d, 5));
            }}
            className={segClasses(manyDays)}
          >
            5+
          </button>
          {manyDays && (
            <input
              type="number"
              min={5}
              max={FRAME_DAYS_MAX}
              value={days}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isInteger(n)) setDays(Math.min(FRAME_DAYS_MAX, Math.max(5, n)));
              }}
              aria-label="Number of days"
              className="w-16 rounded-md border bg-background px-2 py-2 text-sm tabular-nums"
            />
          )}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="daily-miles" className="text-sm font-medium">
          Daily miles that feel right
        </label>
        <input
          id="daily-miles"
          type="range"
          min={MILES_MIN}
          max={MILES_MAX}
          step={MILES_STEP}
          value={miles}
          onChange={(e) => setMiles(Number(e.target.value))}
          className="w-full accent-foreground"
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {`${miles} mi a day. Twisty-country honest, not interstate math.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={() => onSetAction({ days, dailyMiles: miles })}>
          Set the frame
        </Button>
        <Button size="lg" variant="ghost" onClick={onDismissAction}>
          {storedFrame ? "Cancel" : "Skip and ride the map"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Change any of this later. The tray keeps count either way.
      </p>
    </div>
  );
}
