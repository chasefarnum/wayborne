import Link from "next/link";

import { ShellNav } from "@/components/frame/shell-nav";

// The app frame: a slim asphalt bar with the wordmark and the two planning
// surfaces, finished with a double yellow center line. The one brand mark the
// working UI carries — the shell is the road; everything below is what's
// along it. Fixed-asphalt in both color modes, so the mark never inverts.
export function AppShell({
  regionSlug,
  children,
}: {
  regionSlug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="texture-grain shrink-0 bg-shell text-shell-foreground">
        <div className="flex h-12 items-center gap-4 px-4">
          <Link
            href={`/${regionSlug}/plan`}
            className="font-heading text-sm font-bold uppercase leading-none tracking-[0.35em]"
          >
            Wayborne
          </Link>
          <ShellNav regionSlug={regionSlug} />
        </div>
        <div aria-hidden="true" className="flex h-[3px] flex-col justify-between">
          <div className="h-px bg-brand" />
          <div className="h-px bg-brand" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
