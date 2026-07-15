-- Repeatable curation seeding: sweep ids (r-001, s-001, ...) are the stable
-- keys the seed script upserts on, so they must be unique per region.
-- Rows created in-app (no sweep_id) are unaffected: Postgres treats NULLs
-- as distinct in unique indexes.

create unique index road_segments_region_sweep_key on road_segments (region_id, sweep_id);
create unique index stops_region_sweep_key on stops (region_id, sweep_id);
