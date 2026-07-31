import { cn } from "@/lib/utils";

// The banner ribbon (board 04): DAY N in a bone band with rust swallow-tail
// ends. The days view's one added heritage touch; the ends overhang 14px, so
// give it breathing room from container edges.
export function DayRibbon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("day-ribbon", className)}>
      <span aria-hidden="true" className="day-ribbon-end day-ribbon-end-l" />
      <span aria-hidden="true" className="day-ribbon-end day-ribbon-end-r" />
      <span className="day-ribbon-band font-heading text-sm font-bold uppercase tracking-[0.28em]">
        {children}
      </span>
    </span>
  );
}
