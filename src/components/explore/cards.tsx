"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, characterLabel } from "@/lib/explore";
import type { SegmentRow, StopRow } from "@/lib/explore";
import { cn } from "@/lib/utils";

function cardClasses(selected: boolean) {
  return cn(
    "flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors hover:bg-accent",
    selected && "border-foreground"
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-destructive">
      <span aria-hidden="true">▲ </span>
      {children}
    </p>
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
        <Badge variant="outline">{segment.provenance}</Badge>
      </span>
      <span className="text-xs text-muted-foreground">
        {segment.length_mi != null && <>{segment.length_mi} mi · </>}
        {segment.character.map(characterLabel).join(" · ")}
      </span>
      {segment.blurb && <span className="line-clamp-3 text-sm">{segment.blurb}</span>}
      {segment.warnings && <Warn>{segment.warnings}</Warn>}
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
        <Badge variant="outline">{stop.provenance}</Badge>
      </span>
      <span className="text-xs text-muted-foreground">
        {CATEGORY_LABELS[stop.category]}
        {stop.town && <> · {stop.town}</>}
        {stop.rider_signal !== "none" && <> · rider signal: {stop.rider_signal.replace("_", "-")}</>}
      </span>
      {stop.blurb && <span className="line-clamp-3 text-sm">{stop.blurb}</span>}
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
// warnings on the same furniture, provenance badge. "Add to trip" arrives
// with the tray task group.
export function DetailCard({
  selected,
  onCloseAction,
}: {
  selected: SelectedItem;
  onCloseAction: () => void;
}) {
  const isSegment = selected.kind === "segment";
  const item = isSegment ? selected.segment : selected.stop;
  const sources = item.source_urls;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{item.name}</p>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{item.provenance}</Badge>
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
      {item.blurb && <p className="text-sm">{item.blurb}</p>}
      {isSegment && selected.segment.warnings && <Warn>{selected.segment.warnings}</Warn>}
      {item.seasonal_notes && <Warn>{item.seasonal_notes}</Warn>}
      {!isSegment && <Practicals practicals={selected.stop.practicals} />}
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
