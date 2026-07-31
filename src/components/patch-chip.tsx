import { cn } from "@/lib/utils";

// Provenance as a patch (board 02/06): RIDDEN wears the dashed paint-orange
// stitch, RESEARCHED stays a plain hairline oval-turned-chip. Display
// language only — the data values stay `verified` / `researched`, and the
// honesty rule stands: nothing reads RIDDEN until someone rode it.
export function PatchChip({ provenance }: { provenance: string }) {
  const ridden = provenance === "verified";
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]",
        ridden
          ? "border border-dashed border-brand/60 bg-brand/[0.07] text-brand"
          : "border border-border text-muted-foreground"
      )}
    >
      {ridden ? "Ridden" : "Researched"}
    </span>
  );
}
