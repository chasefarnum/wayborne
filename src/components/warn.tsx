// Warning furniture (design.md Decision 5): fuel gaps, enforcement, closures,
// and seasonal notes all wear this one primitive, on cards and day legs
// alike. Signal red owns warnings — its only job in the system (art
// direction: never decorative). The day rail's compact flag and the card
// chip are the variants.

export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-signal">
      <span aria-hidden="true">▲ </span>
      {children}
    </p>
  );
}

export function WarnFlag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap text-signal">
      <span aria-hidden="true">▲ </span>
      {children}
    </span>
  );
}

// The closure chip (review P2 — signal red's first framed job): closure and
// seasonal warnings on road cards sit in a bordered chip so they read as a
// posted notice, not body text.
export function WarnChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5 rounded-sm border border-signal/50 bg-signal/10 px-2 py-1 text-xs text-signal">
      <span aria-hidden="true">▲</span>
      <span>{children}</span>
    </span>
  );
}
