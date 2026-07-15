import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExploreView } from "@/components/explore/explore-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Plan your ride · Wayborne",
};

// RLS is the access gate: the anon server client only ever sees kept,
// open content in published free regions. No visibility logic here.
export default async function PlanPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region: regionSlug } = await params;
  const supabase = await createClient();

  const { data: region } = await supabase
    .from("regions")
    .select("id, slug, name, number")
    .eq("slug", regionSlug)
    .maybeSingle();
  if (!region) notFound();

  const [segmentsRes, stopsRes] = await Promise.all([
    supabase
      .from("road_segments")
      .select(
        "id, sweep_id, name, route_desc, length_mi, sub_area, character, blurb, warnings, seasonal_notes, provenance, source_urls, geom"
      )
      .eq("region_id", region.id)
      .order("sub_area")
      .order("name"),
    supabase
      .from("stops")
      .select(
        "id, sweep_id, name, category, town, blurb, rider_signal, practicals, seasonal_notes, provenance, source_urls, geom"
      )
      .eq("region_id", region.id)
      .order("category")
      .order("name"),
  ]);
  if (segmentsRes.error) throw segmentsRes.error;
  if (stopsRes.error) throw stopsRes.error;

  return (
    <ExploreView
      regionName={region.name}
      segments={segmentsRes.data}
      stops={stopsRes.data}
    />
  );
}
