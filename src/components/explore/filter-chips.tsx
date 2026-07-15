"use client";

import { CHARACTER_TAGS, STOP_GROUPS } from "@/lib/explore";
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
        "rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent",
        active && "border-foreground bg-foreground text-background hover:bg-foreground/90"
      )}
    >
      {label}
      {active && <span aria-hidden="true"> ✕</span>}
    </button>
  );
}

export function FilterChips({
  activeCharacters,
  activeGroups,
  onToggleCharacterAction,
  onToggleGroupAction,
}: {
  activeCharacters: string[];
  activeGroups: string[];
  onToggleCharacterAction: (value: string) => void;
  onToggleGroupAction: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Character:
      </span>
      {CHARACTER_TAGS.map((tag) => (
        <Chip
          key={tag.value}
          label={tag.label}
          active={activeCharacters.includes(tag.value)}
          onToggle={() => onToggleCharacterAction(tag.value)}
        />
      ))}
      <span className="ml-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stops:
      </span>
      {STOP_GROUPS.map((group) => (
        <Chip
          key={group.value}
          label={group.label}
          active={activeGroups.includes(group.value)}
          onToggle={() => onToggleGroupAction(group.value)}
        />
      ))}
    </div>
  );
}
