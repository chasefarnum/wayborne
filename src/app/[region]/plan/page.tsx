import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExploreView } from "@/components/explore/explore-view";
import { TripProvider } from "@/components/trip/trip-provider";
import { fetchRegionContent } from "@/lib/region-content";

export const metadata: Metadata = {
  title: "Plan your ride · Wayborne",
};

export default async function PlanPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: regionSlug } = await params;
  const content = await fetchRegionContent(regionSlug);
  if (!content) notFound();

  return (
    <TripProvider regionSlug={content.region.slug}>
      <ExploreView
        regionSlug={content.region.slug}
        regionName={content.region.name}
        regionId={content.region.id}
        segments={content.segments}
        stops={content.stops}
      />
    </TripProvider>
  );
}
