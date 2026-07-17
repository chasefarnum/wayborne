import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DaysView } from "@/components/trip/days-view";
import { TripProvider } from "@/components/trip/trip-provider";
import { fetchRegionContent } from "@/lib/region-content";

export const metadata: Metadata = {
  title: "Build days · Wayborne",
};

// The assembly surface (wireframe v2, Screen 4): the day is the unit of
// planning; legs end where you sleep.
export default async function DaysPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: regionSlug } = await params;
  const content = await fetchRegionContent(regionSlug);
  if (!content) notFound();

  return (
    <TripProvider regionSlug={content.region.slug}>
      <DaysView
        regionSlug={content.region.slug}
        regionName={content.region.name}
        segments={content.segments}
        stops={content.stops}
      />
    </TripProvider>
  );
}
