import { Skeleton } from "@/components/ui/skeleton";

// Region loading state (wireframe v2, State C): skeletons match the real
// card geometry so the swap does not jump; shimmer respects reduced motion.
// Mirrors the shell layout — left panel skeletons, full-bleed map canvas —
// so the reveal does not reflow.
export default function PlanLoading() {
  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[400px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-4 p-4 lg:border-r">
        <Skeleton className="h-7 w-56 motion-reduce:animate-none" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-sm motion-reduce:animate-none" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32 motion-reduce:animate-none" />
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-xl border p-4">
              <Skeleton className="h-5 w-3/5 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-2/5 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-11/12 motion-reduce:animate-none" />
              <Skeleton className="h-3 w-4/5 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      </aside>
      <div className="relative min-h-[480px] lg:min-h-0">
        <Skeleton className="absolute inset-0 rounded-none motion-reduce:animate-none" />
        <p className="absolute bottom-4 left-4 rounded-md bg-background/90 px-3 py-1.5 text-sm text-muted-foreground">
          Loading the region: roads first, map layers behind them.
        </p>
      </div>
    </div>
  );
}
