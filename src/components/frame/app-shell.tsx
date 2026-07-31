import Link from "next/link";

import { Logo } from "@/components/frame/logo";
import { ShellNav } from "@/components/frame/shell-nav";

// The app frame: a slim cool-black bar with the wordmark and the two planning
// surfaces, finished with a double paint-orange center line. The double line
// is one of the screen's three heritage touches; the shell itself is chassis,
// so it carries no grain. Fixed ground in both color modes.
export function AppShell({
  regionSlug,
  children,
}: {
  regionSlug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="shrink-0 bg-shell text-shell-foreground">
        <div className="flex h-12 items-center gap-4 px-4">
          <Link href={`/${regionSlug}/plan`}>
            <Logo />
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
