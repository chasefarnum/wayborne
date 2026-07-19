-- Route-corridor read path for along-route discovery (OpenSpec change
-- along-route-discovery, design decision 2).
--
-- One RPC returns curated stops and traced road segments within radius_m
-- (default 8046.72 m = 5 mi) of the rider's line, as a single round-trip.
-- SECURITY INVOKER: every row passes through the existing RLS policies, so
-- anon sees exactly what explore's table reads see (keep + open + accessible
-- region), and hold/kill/pending_review stay invisible. Segments with null
-- geom simply never match ST_DWithin: untraced roads are absent, not faked.
--
-- Per row beyond the published columns explore already reads:
--   off_line_m  straight-line meters off the rider's line (geography)
--   along_pos   0..1 fraction along the line at closest approach
--               (ST_LineLocatePoint on the geometry cast; at region scale the
--               degree-space fraction is close enough for "mi N" labels)
-- Geometry returns as GeoJSON (ST_AsGeoJSON), same contract as the computed
-- geojson columns from migration 00003; PostgREST serves raw geography as
-- WKB hex, which the client never parses.
--
-- Rollback: drop function public.content_near_route(uuid, jsonb, float8);

create or replace function public.content_near_route(
  region uuid,
  line jsonb,
  radius_m float8 default 8046.72
)
returns table (
  item_type text,
  id uuid,
  sweep_id text,
  name text,
  category text,
  town text,
  route_desc text,
  length_mi numeric,
  sub_area text,
  "character" text[],
  warnings text,
  blurb text,
  rider_signal text,
  practicals jsonb,
  seasonal_notes text,
  provenance text,
  source_urls text[],
  geom json,
  off_line_m float8,
  along_pos float8
)
language sql
stable
security invoker
set search_path = public
as $$
  with rider_line as (
    select
      st_geomfromgeojson(line)::geography as line_geog,
      st_geomfromgeojson(line)            as line_geom
  )
  select
    'stop'::text                as item_type,
    s.id,
    s.sweep_id,
    s.name,
    s.category::text            as category,
    s.town,
    null::text                  as route_desc,
    null::numeric               as length_mi,
    null::text                  as sub_area,
    null::text[]                as "character",
    null::text                  as warnings,
    s.blurb,
    s.rider_signal::text        as rider_signal,
    s.practicals,
    s.seasonal_notes,
    s.provenance::text          as provenance,
    s.source_urls,
    st_asgeojson(s.geom)::json  as geom,
    st_distance(s.geom, rl.line_geog) as off_line_m,
    st_linelocatepoint(rl.line_geom, s.geom::geometry) as along_pos
  from stops s, rider_line rl
  where s.region_id = region
    and st_dwithin(s.geom, rl.line_geog, radius_m)

  union all

  select
    'segment'::text             as item_type,
    r.id,
    r.sweep_id,
    r.name,
    null::text                  as category,
    null::text                  as town,
    r.route_desc,
    r.length_mi,
    r.sub_area,
    r.character::text[]         as "character",
    r.warnings,
    r.blurb,
    null::text                  as rider_signal,
    null::jsonb                 as practicals,
    r.seasonal_notes,
    r.provenance::text          as provenance,
    r.source_urls,
    st_asgeojson(r.geom)::json  as geom,
    st_distance(r.geom, rl.line_geog) as off_line_m,
    st_linelocatepoint(
      rl.line_geom,
      st_closestpoint(rl.line_geom, r.geom::geometry)
    ) as along_pos
  from road_segments r, rider_line rl
  where r.region_id = region
    and st_dwithin(r.geom, rl.line_geog, radius_m)

  order by along_pos, off_line_m
$$;
