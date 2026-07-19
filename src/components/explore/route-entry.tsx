"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";

// Route entry panel (wireframe Screen 2 + states C/D). The map beside it
// owns the taps; this panel owns GPX import, the two error states, and the
// way out. Two honest inputs, nothing to get wrong: no geocoder text fields,
// no freehand draw in v1.
export function RouteEntry({
  status,
  gpxUnreadable,
  onGpxFileAction,
  onRetryAction,
  onResetTapsAction,
  onBackAction,
}: {
  status: "tapping" | "routing" | "failed";
  gpxUnreadable: boolean;
  onGpxFileAction: (file: File) => void;
  onRetryAction: () => void;
  onResetTapsAction: () => void;
  onBackAction: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Drop your route</h2>
        <p className="text-sm text-muted-foreground">
          Tap your start, tap your end. We draw the line.
        </p>
      </div>

      {status === "routing" && (
        <p role="status" className="rounded-xl border p-4 text-sm">
          Drawing your line…
        </p>
      )}

      {status === "failed" && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border p-4">
          <p className="text-sm font-semibold">Couldn&apos;t draw that line.</p>
          <p className="text-sm text-muted-foreground">
            The routing service didn&apos;t answer. Your start and end are still set.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRetryAction}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              Import GPX instead
            </Button>
          </div>
        </div>
      )}

      {gpxUnreadable && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border p-4">
          <p className="text-sm font-semibold">That file didn&apos;t read as a route.</p>
          <p className="text-sm text-muted-foreground">
            We look for a GPX track or route. Export from your nav app as GPX and try
            again, or tap the line on the map instead.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              Choose another file
            </Button>
            <Button size="sm" onClick={onResetTapsAction}>
              Tap it on the map
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start gap-2 rounded-xl border p-4">
        <p className="text-sm font-semibold">Already have the route?</p>
        <p className="text-sm text-muted-foreground">
          Drop the GPX from Detecht, Garmin, or wherever it lives.
        </p>
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          Import GPX
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onGpxFileAction(file);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Your route stays yours: planned here, ridden in your nav app. We never store it
        server-side.
      </p>

      <div>
        <Button size="sm" variant="ghost" onClick={onBackAction}>
          Back to explore
        </Button>
      </div>
    </div>
  );
}
