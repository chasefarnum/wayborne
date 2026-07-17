"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { DetailCard, SegmentCard, StopCard } from "@/components/explore/cards";
import { FilterChips } from "@/components/explore/filter-chips";
import { FrameSheet } from "@/components/frame/frame-sheet";
import { VerifyProgress } from "@/components/explore/verify-progress";
import { TrayDock } from "@/components/trip/tray-dock";
import { useTrip } from "@/components/trip/trip-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CHARACTER_TAGS, STOP_GROUPS, characterLabel, stopGroupOf } from "@/lib/explore";
import type { SegmentRow, StopRow } from "@/lib/explore";
import { isValidFrame, trayCatalogFrom } from "@/lib/trip";

const ExploreMap = dynamic(() => import("@/components/explore/explore-map"), {
  ssr: false,
  loading: () => (
    <div className="relative h-full min-h-[480px]">
      <Skeleton className="absolute inset-0 rounded-none motion-reduce:animate-none" />
      <p className="absolute bottom-4 left-4 rounded-md bg-background/90 px-3 py-1.5 text-sm text-muted-foreground">
        Loading the map…
      </p>
    </div>
  ),
});

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function ExploreView({
  regionSlug,
  regionName,
  segments,
  stops,
}: {
  regionSlug: string;
  regionName: string;
  segments: SegmentRow[];
  stops: StopRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { frame, setFrame } = useTrip();

  const activeCharacters = parseList(searchParams.get("ch"));
  const activeGroups = parseList(searchParams.get("stops"));
  const selectedId = searchParams.get("sel");

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const toggle = (key: "ch" | "stops", list: string[], value: string) => {
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    setParams({ [key]: next.join(",") || null });
  };
  const select = useCallback(
    (sweepId: string | null) => setParams({ sel: sweepId }),
    [setParams]
  );

  // Frame ↔ URL sync (design.md Decision 4): valid ?days&mi params win over
  // the stored frame (deep-link semantics); otherwise a stored frame reflects
  // into the URL. Mutations read localStorage truth, so items never clobber.
  const daysParam = searchParams.get("days");
  const miParam = searchParams.get("mi");
  const frameDays = frame?.days ?? null;
  const frameMiles = frame?.dailyMiles ?? null;
  useEffect(() => {
    const days = Number(daysParam);
    const mi = Number(miParam);
    if (daysParam !== null && miParam !== null && isValidFrame(days, mi)) {
      if (days !== frameDays || mi !== frameMiles) setFrame({ days, dailyMiles: mi });
    } else if (frameDays !== null && frameMiles !== null) {
      setParams({ days: String(frameDays), mi: String(frameMiles) });
    }
  }, [daysParam, miParam, frameDays, frameMiles, setFrame, setParams]);

  // Everything the tray needs to resolve a stored ref, keyed by sweep id.
  const trayCatalog = useMemo(() => trayCatalogFrom(segments, stops), [segments, stops]);

  // Character filters AND together: a road must carry every active tag.
  const segmentsMatching = useCallback(
    (tags: string[]) =>
      segments.filter((s) => tags.every((t) => (s.character as string[]).includes(t))),
    [segments]
  );
  const filteredSegments = useMemo(
    () => segmentsMatching(activeCharacters),
    [segmentsMatching, activeCharacters]
  );

  // Stop groups OR together: no active group means all stops show.
  const activeCategories = useMemo(
    () =>
      new Set(
        STOP_GROUPS.filter((g) => activeGroups.includes(g.value)).flatMap((g) => g.categories)
      ),
    [activeGroups]
  );
  const filteredStops = useMemo(
    () =>
      activeGroups.length === 0 ? stops : stops.filter((s) => activeCategories.has(s.category)),
    [stops, activeGroups.length, activeCategories]
  );

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const segment = segments.find((s) => s.sweep_id === selectedId);
    if (segment) return { kind: "segment" as const, segment };
    const stop = stops.find((s) => s.sweep_id === selectedId);
    return stop ? { kind: "stop" as const, stop } : null;
  }, [selectedId, segments, stops]);

  // Zero-results explanation (Gate 2 P3): price the fix at one chip when a
  // single drop rescues the set; otherwise plain fallback, never a blank panel.
  const segmentRescue = useMemo(() => {
    if (filteredSegments.length > 0 || activeCharacters.length === 0) return null;
    let best: { tag: string; count: number } | null = null;
    for (const tag of activeCharacters) {
      const count = segmentsMatching(activeCharacters.filter((t) => t !== tag)).length;
      if (count > (best?.count ?? 0)) best = { tag, count };
    }
    return best;
  }, [filteredSegments.length, activeCharacters, segmentsMatching]);

  const groupedSegments = useMemo(() => {
    const groups = new Map<string, SegmentRow[]>();
    for (const s of filteredSegments) {
      const key = s.sub_area ?? "Elsewhere";
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.entries()];
  }, [filteredSegments]);

  const groupedStops = useMemo(() => {
    const groups = new Map<string, StopRow[]>();
    for (const s of filteredStops) {
      const key = stopGroupOf(s.category)?.label ?? "Other";
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.entries()];
  }, [filteredStops]);

  const verifiedRoads = segments.filter((s) => s.provenance === "verified").length;

  // Chip order tracks how much of the region carries each tag — the closest
  // honest popularity proxy until riders generate real usage data. Stable
  // sort keeps the declared order on ties.
  const roadTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of segments) {
      for (const tag of s.character) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...CHARACTER_TAGS].sort(
      (a, b) => (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0)
    );
  }, [segments]);
  const stopGroups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of stops) {
      const group = stopGroupOf(s.category);
      if (group) counts.set(group.value, (counts.get(group.value) ?? 0) + 1);
    }
    return [...STOP_GROUPS].sort(
      (a, b) => (counts.get(b.value) ?? 0) - (counts.get(a.value) ?? 0)
    );
  }, [stops]);

  const listRef = useRef<HTMLDivElement>(null);

  // w-full on the page container matters: the body is a column flex and
  // mx-auto makes this a fit-content flex item, so without an explicit width
  // the page collapses to its widest child instead of filling to max-w-7xl.
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold">{regionName}</h1>
        <VerifyProgress verified={verifiedRoads} total={segments.length} noun="roads" />
      </header>

      <FilterChips
        roadTags={roadTags}
        stopGroups={stopGroups}
        activeCharacters={activeCharacters}
        activeGroups={activeGroups}
        onToggleCharacterAction={(v) => toggle("ch", activeCharacters, v)}
        onToggleGroupAction={(v) => toggle("stops", activeGroups, v)}
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div
          ref={listRef}
          className="flex flex-col gap-3 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              {filteredSegments.length} {filteredSegments.length === 1 ? "road" : "roads"} match
            </h2>
            <span className="text-xs text-muted-foreground">sorted by sub-area</span>
          </div>

          {filteredSegments.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              {segmentRescue ? (
                <>
                  <p className="text-sm font-semibold">
                    No roads match all {activeCharacters.length} filters.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Dropping {characterLabel(segmentRescue.tag as never)} brings back{" "}
                    {segmentRescue.count} {segmentRescue.count === 1 ? "road" : "roads"}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => toggle("ch", activeCharacters, segmentRescue.tag)}>
                      Drop the {characterLabel(segmentRescue.tag as never)} filter
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setParams({ ch: null })}>
                      Clear all filters
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">No road carries all of these at once.</p>
                  <p className="text-sm text-muted-foreground">
                    Clear the filters and start from the region&apos;s full list.
                  </p>
                  <div>
                    <Button size="sm" onClick={() => setParams({ ch: null })}>
                      Clear all filters
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            groupedSegments.map(([subArea, rows]) => (
              <section key={subArea} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {subArea}
                </h3>
                {rows.map((s) => (
                  <SegmentCard
                    key={s.id}
                    segment={s}
                    selected={s.sweep_id === selectedId}
                    onSelectAction={() => select(s.sweep_id)}
                  />
                ))}
              </section>
            ))
          )}

          <div className="mt-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">
              {filteredStops.length} {filteredStops.length === 1 ? "stop" : "stops"}
            </h2>
          </div>

          {filteredStops.length === 0 ? (
            <div className="flex flex-col gap-3 rounded-xl border p-4">
              <p className="text-sm font-semibold">No open stops match these filters.</p>
              <p className="text-sm text-muted-foreground">
                Nothing in{" "}
                {activeGroups
                  .map((g) => STOP_GROUPS.find((sg) => sg.value === g)?.label ?? g)
                  .join(" or ")}{" "}
                is published in this region yet.
              </p>
              <div>
                <Button size="sm" onClick={() => setParams({ stops: null })}>
                  Clear stop filters
                </Button>
              </div>
            </div>
          ) : (
            groupedStops.map(([label, rows]) => (
              <section key={label} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </h3>
                {rows.map((s) => (
                  <StopCard
                    key={s.id}
                    stop={s}
                    selected={s.sweep_id === selectedId}
                    onSelectAction={() => select(s.sweep_id)}
                  />
                ))}
              </section>
            ))
          )}
        </div>

        <div className="relative min-h-[480px] overflow-hidden rounded-xl border lg:h-[calc(100vh-14rem)]">
          <ExploreMap
            segments={filteredSegments}
            stops={filteredStops}
            selectedId={selectedId}
            onSelectAction={select}
          />
          {selected && (
            <div className="absolute right-3 top-3 w-[300px] max-w-[calc(100%-1.5rem)]">
              <DetailCard selected={selected} onCloseAction={() => select(null)} />
            </div>
          )}
        </div>
      </div>

      <TrayDock
        regionSlug={regionSlug}
        catalog={trayCatalog}
        selectedId={selectedId}
        onSelectAction={select}
        onEditFrameAction={() => setParams({ frame: "1" })}
      />

      <FrameSheet autoOpen syncFrameParams />
    </div>
  );
}
