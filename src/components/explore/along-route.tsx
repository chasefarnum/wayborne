"use client";

import { useTrip } from "@/components/trip/trip-provider";
import { PatchChip } from "@/components/patch-chip";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, characterLabel } from "@/lib/explore";
import type { Enums } from "@/lib/database.types";
import {
  INTENT_CHIPS,
  exitNoteText,
  offLineLabel,
  quietNoteText,
} from "@/lib/route";
import type { CorridorNote, OrderedRow } from "@/lib/route";
import { cn } from "@/lib/utils";

// Intent-level chips (gate verdict 4): none active by default, and the
// visible chip state always matches the visible results because both derive
// from the same activeIntents in the same render.
export function IntentChips({
  active,
  onToggleAction,
}: {
  active: string[];
  onToggleAction: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Worth the detour:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {INTENT_CHIPS.map((chip) => {
          const isActive = active.includes(chip.value);
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggleAction(chip.value)}
              className={cn(
                "rounded-sm border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                isActive &&
                  "border-brand bg-brand text-brand-foreground hover:bg-brand/90 hover:text-brand-foreground"
              )}
            >
              {chip.label}
              {isActive && <span aria-hidden="true"> ✕</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CorridorRowCard({
  entry,
  selected,
  onSelectAction,
}: {
  entry: OrderedRow;
  selected: boolean;
  onSelectAction: () => void;
}) {
  const { items, addItem, removeItem } = useTrip();
  const { row, mi } = entry;
  const sweepId = row.sweep_id;
  const inTrip = sweepId != null && items.some((i) => i.id === sweepId);
  const kind = row.item_type === "segment" ? ("segment" as const) : ("stop" as const);

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3",
        selected && "border-foreground"
      )}
    >
      <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">
        mi {mi}
      </span>
      <button
        type="button"
        onClick={onSelectAction}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="flex w-full items-center gap-2">
          <span className="truncate font-semibold">{row.name}</span>
          <PatchChip provenance={row.provenance} />
        </span>
        <span className="text-xs text-muted-foreground">
          {row.item_type === "stop" ? (
            <>
              {CATEGORY_LABELS[row.category as Enums<"stop_category">] ?? row.category}
              {row.town && <> · {row.town}</>}
            </>
          ) : (
            row.character?.map((c) => characterLabel(c as Enums<"road_character">)).join(" · ")
          )}
          {" · "}
          {offLineLabel(row.off_line_m)}
        </span>
      </button>
      {sweepId != null &&
        (inTrip ? (
          <Button variant="ghost" size="sm" onClick={() => removeItem(sweepId)}>
            Remove
          </Button>
        ) : (
          <Button size="sm" onClick={() => addItem({ id: sweepId, kind })}>
            Add
          </Button>
        ))}
    </div>
  );
}

function NoteRow({ note, regionName }: { note: CorridorNote; regionName: string }) {
  return (
    <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
      {note.kind === "quiet" ? (
        <>
          <span className="mr-2 text-xs font-medium">
            mi {note.fromMi}-{note.toMi}
          </span>
          {quietNoteText(note)}
        </>
      ) : (
        exitNoteText(note, regionName)
      )}
    </div>
  );
}

// The along-route list (wireframe Screen 3 + states E/F/G): the ride, in
// order. POI-first milepost rows, off-line distance as the only distance,
// inline notes for quiet stretches and coverage exits, one whole-region
// escape. The header count equals the rows shown, always.
export function AlongRouteList({
  regionName,
  status,
  rows,
  notes,
  lengthMi,
  filtered,
  selectedId,
  onSelectAction,
  onShowWholeRegionAction,
}: {
  regionName: string;
  status: "loading" | "error" | "ready";
  // Post-filter rows, milepost order; the header counts exactly these.
  rows: OrderedRow[];
  // Notes derive from the unfiltered corridor and only render unfiltered:
  // with a chip active the gaps are the rider's own doing.
  notes: CorridorNote[];
  lengthMi: number;
  filtered: boolean;
  selectedId: string | null;
  onSelectAction: (sweepId: string | null) => void;
  onShowWholeRegionAction: () => void;
}) {
  if (status === "loading") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Along your way</h2>
          <span className="text-xs text-muted-foreground">
            finding what&apos;s worth pulling over for…
          </span>
        </div>
        <div role="status" className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          Checking the corridor along your {Math.round(lengthMi)} mi line.
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="flex flex-col gap-2 rounded-xl border p-4">
        <p className="text-sm font-semibold">Couldn&apos;t check the corridor.</p>
        <p className="text-sm text-muted-foreground">
          The content service didn&apos;t answer. Your line is safe; try reloading.
        </p>
      </div>
    );
  }

  const entries: React.ReactNode[] = [];
  rows.forEach((entry, i) => {
    entries.push(
      <CorridorRowCard
        key={entry.row.id}
        entry={entry}
        selected={entry.row.sweep_id != null && entry.row.sweep_id === selectedId}
        onSelectAction={() => onSelectAction(entry.row.sweep_id)}
      />
    );
    if (!filtered) {
      for (const note of notes) {
        if (note.afterIndex === i) {
          entries.push(<NoteRow key={`note-${note.kind}-${i}`} note={note} regionName={regionName} />);
        }
      }
    }
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">
          Along your way · {rows.length} within 5 mi
        </h2>
        <span className="text-xs text-muted-foreground">in ride order</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <p className="text-sm font-semibold">
            {filtered ? "Nothing along your line matches that filter." : "Nothing curated within 5 mi of your line yet."}
          </p>
          <p className="text-sm text-muted-foreground">
            {filtered
              ? "Clear the filter to see the full corridor."
              : "The vetted layer grows region by region; the whole-region catalog is one tap away."}
          </p>
        </div>
      ) : (
        entries
      )}

      <p className="py-1 text-xs text-muted-foreground">
        Corridor is ~5 mi each side.{" "}
        <button
          type="button"
          onClick={onShowWholeRegionAction}
          className="underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Show the whole region instead
        </button>
      </p>
    </div>
  );
}
