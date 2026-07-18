-- Computed GeoJSON columns for PostgREST embedding.
--
-- PostgREST serializes geography columns as WKB hex, not GeoJSON; the app's
-- map layers consume GeoJSON. These row-type functions expose `geom` as
-- GeoJSON via PostgREST computed columns (select "geom:geojson"), keeping the
-- client free of WKB parsing. STABLE + row-typed: only rows RLS already
-- exposes can be embedded, so the access model is unchanged.

create or replace function public.geojson(s public.stops)
returns json
language sql stable
as $$ select st_asgeojson(s.geom)::json $$;

create or replace function public.geojson(r public.road_segments)
returns json
language sql stable
as $$ select st_asgeojson(r.geom)::json $$;
