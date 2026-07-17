"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { FRAME_DAYS_MAX } from "@/lib/trip";
import type { TripFrame } from "@/lib/trip";
import {
  getTripServerSnapshot,
  getTripSnapshot,
  mutateTrip,
  subscribeTrip,
} from "@/lib/trip-storage";
import { cn } from "@/lib/utils";

const DAY_CHOICES = [2, 3, 4] as const;
const MILES_MIN = 100;
const MILES_MAX = 400;
const MILES_STEP = 25;

// The frame screen (wireframe v2, Screen 2, mark ②③): the rider's time
// budget, asked up front and skippable. Setting it lands in explore
// (design.md Decision 7); skipping leaves the tray honestly unframed, no
// silent default (trip-frame spec, "Frame skipped" scenario).
export function FrameForm({ regionSlug }: { regionSlug: string }) {
  const trip = useSyncExternalStore(
    useCallback((listener: () => void) => subscribeTrip(regionSlug, listener), [regionSlug]),
    useCallback(() => getTripSnapshot(regionSlug), [regionSlug]),
    getTripServerSnapshot
  );

  // A stored frame prefills the form; the key remounts the fields once the
  // client snapshot lands so revisiting edits instead of resetting.
  return (
    <FrameFields
      key={trip.frame ? "stored" : "fresh"}
      regionSlug={regionSlug}
      storedFrame={trip.frame}
    />
  );
}

function FrameFields({
  regionSlug,
  storedFrame,
}: {
  regionSlug: string;
  storedFrame: TripFrame | null;
}) {
  const router = useRouter();
  const [days, setDays] = useState(storedFrame?.days ?? 3);
  const [manyDays, setManyDays] = useState((storedFrame?.days ?? 3) > 4);
  const [miles, setMiles] = useState(storedFrame?.dailyMiles ?? 200);

  const setTheFrame = () => {
    mutateTrip(regionSlug, (t) => ({
      ...t,
      frame: { days, dailyMiles: miles },
      frameSkipped: false,
    }));
    router.push(`/${regionSlug}/plan?days=${days}&mi=${miles}`);
  };

  const skip = () => {
    mutateTrip(regionSlug, (t) => ({ ...t, frameSkipped: true }));
    router.push(`/${regionSlug}/plan`);
  };

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
        <Button size="lg" onClick={setTheFrame}>
          Set the frame
        </Button>
        <Button size="lg" variant="ghost" onClick={skip}>
          Skip and ride the map
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Change any of this later. The tray keeps count either way.
      </p>
    </div>
  );
}
