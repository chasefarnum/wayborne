"use client";

import type { CHARACTER_TAGS, STOP_GROUPS } from "@/lib/explore";
import { cn } from "@/lib/utils";

function Chip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "rounded-sm border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "border-brand bg-brand text-brand-foreground hover:bg-brand/90 hover:text-brand-foreground"
      )}
    >
      {label}
      {active && <span aria-hidden="true"> ✕</span>}
    </button>
  );
}

// Two aligned filter rows (2026-07-17 refinement): rider-facing labels
// ("Roads:", never the internal "character"), lighter chips, and the lists
// arrive pre-ordered by tag frequency in the region's data.
export function FilterChips({
  roadTags,
  stopGroups,
  activeCharacters,
  activeGroups,
  onToggleCharacterAction,
  onToggleGroupAction,
}: {
  roadTags: typeof CHARACTER_TAGS;
  stopGroups: typeof STOP_GROUPS;
  activeCharacters: string[];
  activeGroups: string[];
  onToggleCharacterAction: (value: string) => void;
  onToggleGroupAction: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Roads:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {roadTags.map((tag) => (
          <Chip
            key={tag.value}
            label={tag.label}
            active={activeCharacters.includes(tag.value)}
            onToggle={() => onToggleCharacterAction(tag.value)}
          />
        ))}
      </div>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stops:
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {stopGroups.map((group) => (
          <Chip
            key={group.value}
            label={group.label}
            active={activeGroups.includes(group.value)}
            onToggle={() => onToggleGroupAction(group.value)}
          />
        ))}
      </div>
    </div>
  );
}
