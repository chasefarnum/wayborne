import { createClient } from "@/lib/supabase/server";
import type { SegmentRow, StopRow } from "@/lib/explore";

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
        // geom:geojson is the computed GeoJSON column (migration 00003); the
        // raw geography column serializes as WKB hex, which the map can't use.
        "id, sweep_id, name, route_desc, length_mi, sub_area, character, blurb, warnings, seasonal_notes, provenance, source_urls, geom:geojson"
      )
      .eq("region_id", region.id)
      .order("sub_area")
      .order("name")
      // The computed column isn't in the generated types; the row shape is
      // pinned here instead (geom arrives as GeoJSON json).
      .overrideTypes<SegmentRow[]>(),
    supabase
      .from("stops")
      .select(
        "id, sweep_id, name, category, town, blurb, rider_signal, practicals, seasonal_notes, provenance, source_urls, geom:geojson"
      )
      .eq("region_id", region.id)
      .order("category")
      .order("name")
      .overrideTypes<StopRow[]>(),
  ]);
  if (segmentsRes.error) throw segmentsRes.error;
  if (stopsRes.error) throw stopsRes.error;

  return { region, segments: segmentsRes.data, stops: stopsRes.data };
}
