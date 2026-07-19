import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { SegmentRow, StopRow } from "@/lib/explore";

// Client half of region-content: the corridor read for along-route mode.
// It lives apart from region-content.ts because that module imports the
// server Supabase client (next/headers) and can never enter a client bundle;
// the rider's line is client state, so this query runs in the browser.

// ST_DWithin radius: 5 miles in meters. The only corridor width in v1.
export const CORRIDOR_RADIUS_M = 8046.72;

export type CorridorStopRow = StopRow & {
  item_type: "stop";
  off_line_m: number;
  along_pos: number;
};

export type CorridorSegmentRow = SegmentRow & {
  item_type: "segment";
  off_line_m: number;
  along_pos: number;
};

export type CorridorRow = CorridorStopRow | CorridorSegmentRow;

// One round-trip: published stops and traced segments within the corridor,
// each with off-line meters and 0..1 position along the line. RLS is the
// access gate (SECURITY INVOKER RPC); untraced segments never match. The
// generated Functions types flatten the union and drop nullability, so the
// row shape is pinned here instead (geom arrives as GeoJSON json, per the
// migration 00003/00004 contract).
export async function contentNearRoute(
  supabase: SupabaseClient<Database>,
  regionId: string,
  line: GeoJSON.LineString,
  radiusM: number = CORRIDOR_RADIUS_M
): Promise<CorridorRow[]> {
  const { data, error } = await supabase
    .rpc("content_near_route", {
      region: regionId,
      line: line as unknown as Database["public"]["Functions"]["content_near_route"]["Args"]["line"],
      radius_m: radiusM,
    })
    .overrideTypes<CorridorRow[], { merge: false }>();
  if (error) throw error;
  return data;
}
