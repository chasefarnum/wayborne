import { Skeleton } from "@/components/ui/skeleton";

// Region loading state (wireframe v2, State C): skeletons match the real
// card geometry so the swap does not jump; shimmer respects reduced motion.
export default function PlanLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4">
      <div className="flex gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full motion-reduce:animate-none" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
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
        <div className="relative min-h-[480px] overflow-hidden rounded-xl border">
          <Skeleton className="absolute inset-0 rounded-none motion-reduce:animate-none" />
          <p className="absolute bottom-4 left-4 rounded-md bg-background/90 px-3 py-1.5 text-sm text-muted-foreground">
            Loading the region: roads first, map layers behind them.
          </p>
        </div>
      </div>
    </div>
  );
}
