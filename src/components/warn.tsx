// Warning furniture (design.md Decision 5): fuel gaps, enforcement, closures,
// and seasonal notes all wear this one primitive, on cards and day legs
// alike. The day rail's compact flag is the only variant.

export function Warn({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-destructive">
      <span aria-hidden="true">▲ </span>
      {children}
    </p>
  );
}

export function WarnFlag({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap text-destructive">
      <span aria-hidden="true">▲ </span>
      {children}
    </span>
  );
}
