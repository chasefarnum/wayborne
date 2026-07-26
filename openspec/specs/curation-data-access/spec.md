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

### Requirement: Corridor reads go through the content_near_route RPC
Route-corridor queries SHALL use a single Postgres RPC, `content_near_route(region, line, radius_m)`, declared SECURITY INVOKER so all rows pass through the existing RLS policies. The RPC SHALL filter with ST_DWithin against the geography columns (default radius 8046.72 m) and return, per row, the published columns explore reads plus `off_line_m` and `along_pos` (position along the rider's line). Geometry SHALL return through the computed `geojson` path (PostgREST serves raw geography as WKB hex).

#### Scenario: Anonymous rider queries a corridor
- **WHEN** the along-route surface calls the RPC with the anon client
- **THEN** only `review_status = 'keep'` rows in accessible regions return, each with off-line distance and along-route position, and `hold`/`kill`/`pending_review` rows are absent

#### Scenario: Untraced road segments
- **WHEN** the RPC runs while road segments have null geometry
- **THEN** those segments are simply absent from corridor results, and they join in milepost order once traced geometry lands

### Requirement: Routes are joined per segment
Curated route geometry SHALL always be assembled by joining `route_segments` in position order; a curated route SHALL never be merged into a single LineString for querying or storage. The rider's own route line is not a curated composition: it legitimately exists as one LineString, held client-side and passed to the corridor RPC as a single geometry.

#### Scenario: Route rendered on explore
- **WHEN** a curated route displays on the map
- **THEN** its segments load as individual geometries joined over `route_segments` ordered by `position`

#### Scenario: Rider's line queried
- **WHEN** the corridor RPC receives the rider's route
- **THEN** it accepts one LineString, and no attempt is made to decompose or store it as curated segments

### Requirement: Queries are typed from the live schema
Database access SHALL use TypeScript types generated from the executed schema (`supabase gen types typescript`), regenerated whenever a migration lands.

#### Scenario: Migration adds a column
- **WHEN** a new migration executes
- **THEN** types are regenerated and the build fails on any query that no longer matches the schema
