import { createClient } from "@/lib/supabase/server";

// One fetch shape for every planning surface (explore, days). RLS is the
// access gate: the anon server client only ever sees kept, open content in
// published free regions.
export async function fetchRegionContent(regionSlug: string) {
  const supabase = await createClient();

  const { data: region } = await supabase
    .from("regions")
    .select("id, slug, name, number")
    .eq("slug", regionSlug)
    .maybeSingle();
  if (!region) return null;

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

  return { region, segments: segmentsRes.data, stops: stopsRes.data };
}
