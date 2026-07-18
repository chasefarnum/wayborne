# curation-data-access

## Requirements

### Requirement: RLS is the access gate
All reads SHALL go through the Supabase anon/authenticated clients so Row Level Security enforces visibility (kept content in accessible regions for the public; everything for curators). App code SHALL NOT re-implement access rules or use the service role key in app routes.

#### Scenario: Anonymous rider browses region 01
- **WHEN** the explore surface fetches segments and stops with the anon client
- **THEN** only `review_status = 'keep'` rows in published free regions return, with `pending_review`, `kill`, and `hold` rows absent

### Requirement: Geo queries use ST_DWithin only
Any proximity or radius query SHALL use ST_DWithin against the geography(4326) columns, with the 5-mile radius expressed as 8046.72 meters. ST_Buffer and ST_Distance in WHERE clauses SHALL NOT be used.

#### Scenario: Stops near a segment
- **WHEN** a feature needs stops within 5 miles of a segment
- **THEN** the query is an ST_DWithin call (via Postgres RPC) with 8046.72 meters, using the GiST indexes

### Requirement: Routes are joined per segment
Route geometry SHALL always be assembled by joining `route_segments` in position order; a route SHALL never be merged into a single LineString for querying or storage.

#### Scenario: Route rendered on explore
- **WHEN** a route displays on the map
- **THEN** its segments load as individual geometries joined over `route_segments` ordered by `position`

### Requirement: Queries are typed from the live schema
Database access SHALL use TypeScript types generated from the executed schema (`supabase gen types typescript`), regenerated whenever a migration lands.

#### Scenario: Migration adds a column
- **WHEN** a new migration executes
- **THEN** types are regenerated and the build fails on any query that no longer matches the schema
