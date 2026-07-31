"use client";

import { PatchChip } from "@/components/patch-chip";
import { useTrip } from "@/components/trip/trip-provider";
import { Button } from "@/components/ui/button";
import { WarnChip } from "@/components/warn";
import { CATEGORY_LABELS, characterLabel } from "@/lib/explore";
import type { SegmentRow, StopRow } from "@/lib/explore";
import { cn } from "@/lib/utils";

function cardClasses(selected: boolean) {
  return cn(
    "panel-card flex w-full flex-col items-start gap-1 p-4 text-left transition-colors",
    selected && "border-foreground"
  );
}

export function SegmentCard({
  segment,
  selected,
  onSelectAction,
}: {
  segment: SegmentRow;
  selected: boolean;
  onSelectAction: () => void;
}) {
  return (
    <button type="button" onClick={onSelectAction} aria-pressed={selected} className={cardClasses(selected)}>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold">{segment.name}</span>
        <PatchChip provenance={segment.provenance} />
      </span>
      <span className="text-xs text-muted-foreground">
        {segment.length_mi != null && <>{segment.length_mi} mi · </>}
        {segment.character.map(characterLabel).join(" · ")}
      </span>
      {segment.blurb && (
        <span className="line-clamp-3 font-serif text-sm leading-relaxed">{segment.blurb}</span>
      )}
      {segment.warnings && <WarnChip>{segment.warnings}</WarnChip>}
    </button>
  );
}

export function StopCard({
  stop,
  selected,
  onSelectAction,
}: {
  stop: StopRow;
  selected: boolean;
  onSelectAction: () => void;
}) {
  return (
    <button type="button" onClick={onSelectAction} aria-pressed={selected} className={cardClasses(selected)}>
      <span className="flex w-full items-center justify-between gap-2">
        <span className="font-semibold">{stop.name}</span>
        <PatchChip provenance={stop.provenance} />
      </span>
      <span className="text-xs text-muted-foreground">
        {CATEGORY_LABELS[stop.category]}
        {stop.town && <> · {stop.town}</>}
        {stop.rider_signal !== "none" && <> · rider signal: {stop.rider_signal.replace("_", "-")}</>}
      </span>
      {stop.blurb && (
        <span className="line-clamp-3 font-serif text-sm leading-relaxed">{stop.blurb}</span>
      )}
    </button>
  );
}

function Practicals({ practicals }: { practicals: StopRow["practicals"] }) {
  if (!practicals || typeof practicals !== "object" || Array.isArray(practicals)) return null;
  const entries = Object.entries(practicals).filter(([, v]) => typeof v === "string");
  if (entries.length === 0) return null;
  return (
    <dl className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-1">
          <dt className="font-medium capitalize">{key}:</dt>
          <dd>{value as string}</dd>
        </div>
      ))}
    </dl>
  );
}

export type SelectedItem =
  | { kind: "segment"; segment: SegmentRow }
  | { kind: "stop"; stop: StopRow };

// The explore float card (wireframe v2, Screen 3): full editorial blurb,
// warnings on the same furniture, provenance badge, add-to-trip into the
// tray dock.
export function DetailCard({
  selected,
  onCloseAction,
}: {
  selected: SelectedItem;
  onCloseAction: () => void;
}) {
  const { items, addItem, removeItem } = useTrip();
  const isSegment = selected.kind === "segment";
  const item = isSegment ? selected.segment : selected.stop;
  const sources = item.source_urls;
  const sweepId = item.sweep_id;
  const inTrip = sweepId != null && items.some((i) => i.id === sweepId);

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{item.name}</p>
        <div className="flex items-center gap-1.5">
          <PatchChip provenance={item.provenance} />
          <Button variant="ghost" size="sm" aria-label="Close details" onClick={onCloseAction}>
            ✕
          </Button>
        </div>
      </div>
      {isSegment ? (
        <>
          <p className="text-xs text-muted-foreground">{selected.segment.route_desc}</p>
          <p className="text-xs text-muted-foreground">
            {selected.segment.length_mi != null && <>{selected.segment.length_mi} mi · </>}
            {selected.segment.character.map(characterLabel).join(" · ")}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          {CATEGORY_LABELS[selected.stop.category]}
          {selected.stop.town && <> · {selected.stop.town}</>}
          {selected.stop.rider_signal !== "none" && (
            <> · rider signal: {selected.stop.rider_signal.replace("_", "-")}</>
          )}
        </p>
      )}
      {item.blurb && <p className="font-serif text-[15px] leading-relaxed">{item.blurb}</p>}
      {isSegment && selected.segment.warnings && <WarnChip>{selected.segment.warnings}</WarnChip>}
      {item.seasonal_notes && <WarnChip>{item.seasonal_notes}</WarnChip>}
      {!isSegment && <Practicals practicals={selected.stop.practicals} />}
      {sweepId != null && (
        <div className="pt-1">
          {inTrip ? (
            <Button variant="ghost" size="sm" onClick={() => removeItem(sweepId)}>
              Remove from trip
            </Button>
          ) : (
            <Button size="sm" onClick={() => addItem({ id: sweepId, kind: selected.kind })}>
              Add to trip
            </Button>
          )}
        </div>
      )}
      {sources.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Sources ({sources.length})</summary>
          <ul className="mt-1 list-inside list-disc">
            {sources.map((src) => (
              <li key={src}>{src}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
