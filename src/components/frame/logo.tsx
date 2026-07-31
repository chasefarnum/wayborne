import { cn } from "@/lib/utils";

// The drawn compass stamp (badge B1's core): the shell mark, and the mark
// the sky plates carry. Inherits currentColor.
export function CompassStamp({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="8"
      className={className}
    >
      <circle cx="100" cy="100" r="90" />
      <circle cx="100" cy="100" r="30" />
      <path d="M100 10 V70 M100 130 V190 M10 100 H70 M130 100 H190" />
    </svg>
  );
}

// The one place wordmark markup lives (art direction round 5). Interim
// lockup: the drawn compass stamp plus tracked caps. Chase supplies the real
// logo later — replace this component's internals and every surface follows.
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-heading text-sm font-bold uppercase leading-none tracking-[0.35em]",
        className
      )}
    >
      <CompassStamp />
      Wayborne
    </span>
  );
}
