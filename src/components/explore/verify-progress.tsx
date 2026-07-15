import { Badge } from "@/components/ui/badge";

// Verification-as-progress (wireframe v2, mark ①/⑦): the zero-state is the
// truth of the dataset, framed as a season starting. Numbers are computed
// from provenance; nothing is ever faked toward 'verified'.
export function VerifyProgress({
  verified,
  total,
  noun,
}: {
  verified: number;
  total: number;
  noun: string;
}) {
  const pct = total > 0 ? Math.round((verified / total) * 100) : 0;
  return (
    <div className="flex w-64 max-w-full flex-col gap-1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="outline">researched</Badge>
        <span>
          {verified} of {total} {noun} verified
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        Riding season underway. Badges land as we ride, never before.
      </p>
    </div>
  );
}
