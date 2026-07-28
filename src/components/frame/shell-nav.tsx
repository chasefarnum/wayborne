"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Client-side only for the active state: the shell itself stays a server
// component and the pathname decides which surface is current.
export function ShellNav({ regionSlug }: { regionSlug: string }) {
  const pathname = usePathname();

  const links = [
    { href: `/${regionSlug}/plan`, label: "Map" },
    { href: `/${regionSlug}/days`, label: "Days" },
  ];

  return (
    <nav aria-label="Planning surfaces" className="ml-auto flex items-center gap-1">
      {links.map(({ href, label }) => {
        const current = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 font-heading text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
              current
                ? "text-brand"
                : "text-shell-foreground/70 hover:text-shell-foreground"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
